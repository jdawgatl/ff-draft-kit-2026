// Best-effort player headshots, sourced from ESPN's public (unofficial,
// undocumented) team-roster API — the same family of endpoint already used
// for the news feed (see espnNews.ts / api/espn/news.js). It isn't a
// published/supported API, can change or rate-limit without notice, and
// should never be treated as guaranteed to resolve. Every call site must
// degrade gracefully to a generated initials avatar — see
// PlayerDetailDrawer.tsx's <img onError=...> fallback.
//
// Design: instead of guessing at ESPN's internal numeric athlete IDs (which
// aren't derivable from a name), we fetch the player's *team* roster (one
// request per team, cached in memory for the session) and match by name.
// The roster response includes each athlete's headshot URL directly, so
// there's no CDN URL pattern to hand-construct or get wrong.

import { normalizePlayerName } from './nameMatch';

// ESPN's internal numeric team IDs. These are undocumented but stable and
// widely used by hobby fantasy-football projects; not published by ESPN.
const ESPN_TEAM_IDS: Record<string, number> = {
  ARI: 22, ATL: 1, BAL: 33, BUF: 2, CAR: 29, CHI: 3, CIN: 4, CLE: 5,
  DAL: 6, DEN: 7, DET: 8, GB: 9, HOU: 34, IND: 11, JAX: 30, KC: 12,
  LAC: 24, LAR: 14, LV: 13, MIA: 15, MIN: 16, NE: 17, NO: 18, NYG: 19,
  NYJ: 20, PHI: 21, PIT: 23, SEA: 26, SF: 25, TB: 27, TEN: 10, WAS: 28,
};

interface RosterEntry {
  norm: string;
  headshot: string | null;
}

const teamRosterCache = new Map<string, Promise<RosterEntry[]>>();

async function fetchTeamRoster(teamAbbr: string): Promise<RosterEntry[]> {
  const espnId = ESPN_TEAM_IDS[teamAbbr];
  if (!espnId) return [];

  const cached = teamRosterCache.get(teamAbbr);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const res = await fetch(`/api/espn/roster?teamId=${espnId}`);
      if (!res.ok) return [];
      const json = await res.json();
      const athletes = (json.athletes || []) as { fullName?: string; headshot?: string }[];
      return athletes
        .filter((a) => a.fullName)
        .map((a) => ({ norm: normalizePlayerName(a.fullName!), headshot: a.headshot || null }));
    } catch {
      return [];
    }
  })();

  teamRosterCache.set(teamAbbr, promise);
  return promise;
}

/** Resolves a headshot image URL for a player, or null if unavailable —
 * callers must render a fallback avatar rather than an empty/broken image. */
export async function getPlayerHeadshotUrl(name: string, team: string): Promise<string | null> {
  const roster = await fetchTeamRoster(team);
  if (roster.length === 0) return null;
  const target = normalizePlayerName(name);
  const match = roster.find((r) => r.norm === target);
  return match?.headshot ?? null;
}

/** Team logo (works for DEF/ST "players" and as a background badge). ESPN
 * serves these from a stable public CDN path keyed by lowercase abbreviation. */
export function getTeamLogoUrl(team: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${team.toLowerCase()}.png`;
}
