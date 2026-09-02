import type { Player } from '../types';

/**
 * "Sleeper" heuristic: a player being drafted comfortably outside the early
 * rounds (ADP > 50) whose internally-computed overall rank is meaningfully
 * better than where the market (ADP) has them going — i.e. a likely-value
 * pick that could outperform their draft slot. Restricted to skill
 * positions, since K/DEF ADP-vs-rank gaps aren't a meaningful signal.
 */
export function isSleeper(player: Player): boolean {
  if (player.position === 'K' || player.position === 'DEF') return false;
  return player.adp > 50 && player.adp - player.overallRank >= 20;
}

/** Maps a handcuff's player id -> the name of the lead back they handcuff. */
export function buildHandcuffLeadNameMap(allPlayers: Player[]): Map<string, string> {
  const byId = new Map(allPlayers.map((p) => [p.id, p]));
  const map = new Map<string, string>();
  for (const p of allPlayers) {
    if (p.handcuffFor) {
      const lead = byId.get(p.handcuffFor);
      if (lead) map.set(p.id, lead.name);
    }
  }
  return map;
}
