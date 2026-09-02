import { useDraftStore, type PlayerOverride } from '../store/draftStore';
import { crossStorage } from './storage';
import { normalizePlayerName } from './nameMatch';
import { getStoredFantasyProsKey, fetchExpertRankings, fetchExpertNews } from './fantasyProsApi';
import { fetchEspnPlayerNews } from './espnNews';

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';
const SLEEPER_TRENDING_URL = (dir: 'add' | 'drop') =>
  `https://api.sleeper.app/v1/players/nfl/trending/${dir}?lookback_hours=24&limit=50`;
const CACHE_KEY = 'ffdk-sleeper-cache-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — keeps free-tier API usage low for 5+ concurrent users

interface SleeperPlayer {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string | null;
  position?: string | null;
  injury_status?: string | null;
  status?: string | null;
}

interface SleeperTrendingEntry {
  player_id: string;
  count: number;
}

function mapInjuryStatus(raw?: string | null): 'Q' | 'D' | 'O' | 'IR' | 'PUP' | 'SUS' | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (s.includes('QUEST')) return 'Q';
  if (s.includes('DOUBT')) return 'D';
  if (s.includes('OUT')) return 'O';
  if (s.includes('IR')) return 'IR';
  if (s.includes('PUP')) return 'PUP';
  if (s.includes('SUSPEN')) return 'SUS';
  return null;
}

async function getSleeperPlayers(): Promise<Record<string, SleeperPlayer>> {
  const cachedRaw = await crossStorage.getItem(CACHE_KEY);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw) as { ts: number; data: Record<string, SleeperPlayer> };
    if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  }
  const res = await fetch(SLEEPER_PLAYERS_URL);
  if (!res.ok) throw new Error(`Sleeper API responded ${res.status}`);
  const data = (await res.json()) as Record<string, SleeperPlayer>;
  await crossStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  return data;
}

interface RefreshResult {
  ok: boolean;
  updatedCount: number;
  trendingCount: number;
  newsCount: number;
  expertRankCount: number;
  sources: string[];
  errors: string[];
}

/**
 * The single "Refresh Data" pipeline. Pulls whatever free live signals are
 * available and merges them into the player pool:
 *   1. Sleeper player metadata (injury status, current team) — always, free, no key.
 *   2. Sleeper trending adds/drops (last 24h) — always, free, no key. Often
 *      the earliest signal of breaking news, before rankings sites update.
 *   3. ESPN NFL news headlines — always, free, no key, best-effort (see
 *      lib/espnNews.ts for the "unofficial endpoint" caveat).
 *   4. FantasyPros consensus expert rankings + injury/news — always, via a
 *      shared FantasyPros key baked into the app server-side.
 * Every step is independently wrapped so one failing source (e.g. ESPN's
 * endpoint changing) never blocks the others or breaks the app.
 */
export async function refreshLiveData(): Promise<RefreshResult> {
  const state = useDraftStore.getState();
  const overrides: Record<string, PlayerOverride> = {};
  const sources: string[] = [];
  const errors: string[] = [];
  let trendingCount = 0;
  let newsCount = 0;
  let expertRankCount = 0;

  const nameToPlayer = new Map(state.allPlayers.map((p) => [normalizePlayerName(p.name), p]));

  function addOverride(playerId: string, patch: PlayerOverride) {
    overrides[playerId] = { ...overrides[playerId], ...patch };
  }

  // 1 & 2. Sleeper metadata + trending
  try {
    const sleeperPlayers = await getSleeperPlayers();
    const byName = new Map<string, SleeperPlayer & { id: string }>();
    for (const [id, p] of Object.entries(sleeperPlayers)) {
      const name = p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      if (!name) continue;
      byName.set(normalizePlayerName(name), { ...p, id });
    }

    for (const player of state.allPlayers) {
      const sp = byName.get(normalizePlayerName(player.name));
      if (!sp) continue;
      const injuryStatus = mapInjuryStatus(sp.injury_status);
      const team = sp.team ?? undefined;
      if (injuryStatus !== player.injuryStatus || (team && team !== player.team)) {
        addOverride(player.id, { injuryStatus, team });
      }
    }
    sources.push('Sleeper');

    const idToName = new Map<string, string>();
    for (const [id, p] of Object.entries(sleeperPlayers)) {
      const name = p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      if (name) idToName.set(id, name);
    }

    const [addRes, dropRes] = await Promise.all([
      fetch(SLEEPER_TRENDING_URL('add')),
      fetch(SLEEPER_TRENDING_URL('drop')),
    ]);
    if (addRes.ok && dropRes.ok) {
      const adds = (await addRes.json()) as SleeperTrendingEntry[];
      const drops = (await dropRes.json()) as SleeperTrendingEntry[];
      for (const [dir, list] of [['up', adds], ['down', drops]] as const) {
        for (const entry of list) {
          const name = idToName.get(entry.player_id);
          if (!name) continue;
          const player = nameToPlayer.get(normalizePlayerName(name));
          if (!player) continue;
          addOverride(player.id, { trending: dir, trendingCount: entry.count });
          trendingCount++;
        }
      }
      sources.push('Sleeper Trending');
    }
  } catch (err) {
    errors.push(`Sleeper: ${(err as Error).message}`);
  }

  // 3. ESPN news (free bonus signal, best-effort)
  try {
    const names = state.allPlayers.map((p) => p.name);
    const espnNews = await fetchEspnPlayerNews(names);
    for (const [normName, items] of espnNews) {
      const player = nameToPlayer.get(normName);
      if (!player) continue;
      addOverride(player.id, { news: items });
      newsCount += items.length;
    }
    if (espnNews.size > 0) sources.push('ESPN');
  } catch (err) {
    errors.push(`ESPN: ${(err as Error).message}`);
  }

  // 4. FantasyPros expert consensus rankings + news — the app ships with a
  // shared FantasyPros key baked in server-side, so this always runs; a
  // locally-saved key (legacy, from before the key was baked in) is still
  // honored as an override if present.
  const fpKey = getStoredFantasyProsKey() || undefined;
  try {
    const [ranks, news] = await Promise.all([
      fetchExpertRankings(fpKey),
      fetchExpertNews(fpKey),
    ]);
    for (const [normName, r] of ranks.byNormalizedName) {
      const player = nameToPlayer.get(normName);
      if (!player) continue;
      addOverride(player.id, { expertRank: r.rank, expertTier: r.tier });
      expertRankCount++;
    }
    for (const [normName, items] of news.byNormalizedName) {
      const player = nameToPlayer.get(normName);
      if (!player) continue;
      addOverride(player.id, { news: items });
      newsCount += items.length;
    }
    sources.push('FantasyPros');
  } catch (err) {
    errors.push(`FantasyPros: ${(err as Error).message}`);
  }

  const updatedCount = Object.keys(overrides).length;
  if (updatedCount > 0) state.applyPlayerOverrides(overrides);

  return {
    ok: errors.length === 0 || sources.length > 0,
    updatedCount,
    trendingCount,
    newsCount,
    expertRankCount,
    sources,
    errors,
  };
}
