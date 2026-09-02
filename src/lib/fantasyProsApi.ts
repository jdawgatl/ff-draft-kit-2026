import type { NewsItem } from '../types';
import { normalizePlayerName } from './nameMatch';

const STORAGE_KEY = 'ffdk-fantasypros-key';

export function getStoredFantasyProsKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setStoredFantasyProsKey(key: string): void {
  if (key) localStorage.setItem(STORAGE_KEY, key);
  else localStorage.removeItem(STORAGE_KEY);
}

interface ProxyResource {
  resource: 'rankings' | 'projections' | 'news';
  params?: Record<string, string>;
}

// apiKey is optional — the server proxy has a shared FantasyPros key baked
// in via an environment variable, so this is only needed as a local-dev
// override when that env var isn't configured.
async function callProxy(apiKey: string | undefined, opts: ProxyResource): Promise<unknown> {
  const res = await fetch('/api/fantasypros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(apiKey ? { apiKey } : {}), sport: 'nfl', ...opts }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `FantasyPros proxy responded ${res.status}`);
  return json;
}

// FantasyPros' v2 JSON field names aren't fully pinned down in their public
// docs, and can vary by endpoint version. These extractors try several
// plausible key names defensively rather than assuming one exact shape —
// if FantasyPros changes their response format, only this file needs
// updating (see README.md → "FantasyPros API Setup" for how to debug it).
function firstOf(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return undefined;
}

function asArray(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    for (const v of Object.values(json as Record<string, unknown>)) {
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

export interface ExpertRankResult {
  byNormalizedName: Map<string, { rank: number; tier?: number }>;
}

export async function fetchExpertRankings(
  apiKey: string | undefined,
  scoring: 'PPR' | 'HALF' | 'STD' = 'PPR'
): Promise<ExpertRankResult> {
  const json = await callProxy(apiKey, { resource: 'rankings', params: { position: 'ALL', scoring } });
  const rows = asArray((json as { rankings?: unknown }).rankings ?? json);

  const byNormalizedName = new Map<string, { rank: number; tier?: number }>();
  for (const row of rows) {
    const name = firstOf(row, ['player_name', 'name', 'full_name']);
    const rank = firstOf(row, ['rank_ecr', 'ecr', 'rank', 'rank_avg', 'rank_ave']);
    const tier = firstOf(row, ['tier', 'rank_tier']);
    if (typeof name !== 'string') continue;
    const rankNum = Number(rank);
    if (!Number.isFinite(rankNum)) continue;
    byNormalizedName.set(normalizePlayerName(name), {
      rank: rankNum,
      tier: tier != null ? Number(tier) : undefined,
    });
  }
  return { byNormalizedName };
}

export interface ExpertNewsResult {
  byNormalizedName: Map<string, NewsItem[]>;
}

export async function fetchExpertNews(apiKey: string | undefined): Promise<ExpertNewsResult> {
  const json = await callProxy(apiKey, { resource: 'news', params: { limit: '100' } });
  const rows = asArray((json as { news?: unknown }).news ?? json);

  const byNormalizedName = new Map<string, NewsItem[]>();
  for (const row of rows) {
    const name = firstOf(row, ['player_name', 'name']);
    const headline = firstOf(row, ['headline', 'title', 'blurb']);
    if (typeof name !== 'string' || typeof headline !== 'string') continue;
    const item: NewsItem = {
      headline,
      source: 'FantasyPros',
      category: firstOf(row, ['category', 'type']) as string | undefined,
      publishedAt: firstOf(row, ['date', 'published', 'created_at']) as string | undefined,
    };
    const key = normalizePlayerName(name);
    const list = byNormalizedName.get(key) ?? [];
    list.push(item);
    byNormalizedName.set(key, list);
  }
  return { byNormalizedName };
}
