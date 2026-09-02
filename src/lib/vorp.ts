import type { LeagueSettings, Player, Position } from '../types';

/**
 * Determines the "replacement level" rank for each position given the
 * league's starting roster requirements, accounting for the shared
 * FLEX pool (RB/WR/TE) by apportioning flex starts across those three
 * positions in proportion to their typical flex usage.
 */
function replacementRanks(settings: LeagueSettings): Record<Position, number> {
  const teams = settings.teams;
  const { QB, RB, WR, TE, FLEX, K, DEF } = settings.rosterSlots;

  // Typical flex allocation share (RB/WR/TE eligible for W/R/T flex).
  const flexShare = { RB: 0.45, WR: 0.45, TE: 0.1 };

  const rbFlex = Math.round(FLEX * flexShare.RB);
  const wrFlex = Math.round(FLEX * flexShare.WR);
  const teFlex = FLEX - rbFlex - wrFlex;

  return {
    QB: teams * QB,
    RB: teams * (RB + rbFlex),
    WR: teams * (WR + wrFlex),
    TE: teams * (TE + teFlex),
    K: teams * K,
    DEF: teams * DEF,
  };
}

export interface VorpResult {
  vorpByPlayerId: Record<string, number>;
  tierByPlayerId: Record<string, number>;
  positionRankByPlayerId: Record<string, number>;
  replacementByPosition: Record<Position, number>;
}

export function computeVorpAndTiers(
  players: Player[],
  settings: LeagueSettings
): VorpResult {
  const replacement = replacementRanks(settings);
  const byPosition: Record<Position, Player[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
  };
  for (const p of players) byPosition[p.position].push(p);

  const vorpByPlayerId: Record<string, number> = {};
  const tierByPlayerId: Record<string, number> = {};
  const positionRankByPlayerId: Record<string, number> = {};
  const replacementByPosition: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };

  (Object.keys(byPosition) as Position[]).forEach((pos) => {
    const list = [...byPosition[pos]].sort((a, b) => b.projectedPoints - a.projectedPoints);
    const replIdx = Math.min(replacement[pos], list.length) - 1;
    const replPts = list.length ? list[Math.max(replIdx, 0)].projectedPoints : 0;
    replacementByPosition[pos] = replPts;

    list.forEach((p, i) => {
      positionRankByPlayerId[p.id] = i + 1;
      vorpByPlayerId[p.id] = Math.round((p.projectedPoints - replPts) * 100) / 100;
    });

    // Tiering: cluster by natural point gaps within a position (greedy
    // largest-gap breakpoint detection), capped at 6 tiers.
    assignTiers(list, tierByPlayerId);
  });

  return { vorpByPlayerId, tierByPlayerId, positionRankByPlayerId, replacementByPosition };
}

function assignTiers(sortedPlayers: Player[], out: Record<string, number>): void {
  if (sortedPlayers.length === 0) return;
  const MAX_TIERS = 6;
  const pts = sortedPlayers.map((p) => p.projectedPoints);

  // Compute consecutive gaps
  const gaps: { idx: number; size: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    gaps.push({ idx: i, size: pts[i - 1] - pts[i] });
  }
  gaps.sort((a, b) => b.size - a.size);
  const breakpoints = new Set(gaps.slice(0, MAX_TIERS - 1).map((g) => g.idx));

  let tier = 1;
  sortedPlayers.forEach((p, i) => {
    if (i > 0 && breakpoints.has(i)) tier++;
    out[p.id] = Math.min(tier, MAX_TIERS);
  });
}
