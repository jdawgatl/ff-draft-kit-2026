import type { LeagueSettings, Player, PlayerBio, StatLine } from '../types';
import { calculateFantasyPoints } from '../lib/scoring';
import { computeVorpAndTiers } from '../lib/vorp';
import raw from './players.generated.json';

interface RawPlayer extends PlayerBio {
  stats: StatLine;
  adp: number;
  adpStdDev: number;
  handcuffFor?: string;
}

/**
 * Builds the fully-scored, ranked player pool from the offline dataset,
 * running every player's raw stat projection through the league's exact
 * custom scoring engine. Re-run whenever league settings change (e.g. after
 * a Yahoo OAuth settings sync) to keep points/VORP/tiers in sync.
 */
export function buildPlayerPool(settings: LeagueSettings): Player[] {
  const rawPlayers = raw as RawPlayer[];

  const scored: Player[] = rawPlayers.map((rp) => ({
    ...rp,
    projectedPoints: calculateFantasyPoints(rp.stats, settings.scoring),
    positionRank: 0,
    overallRank: 0,
    vorp: 0,
    tier: 1,
  }));

  const { vorpByPlayerId, tierByPlayerId, positionRankByPlayerId } = computeVorpAndTiers(
    scored,
    settings
  );

  scored.forEach((p) => {
    p.vorp = vorpByPlayerId[p.id] ?? 0;
    p.tier = tierByPlayerId[p.id] ?? 6;
    p.positionRank = positionRankByPlayerId[p.id] ?? 999;
  });

  // Overall rank by VORP (best draft-value ordering), with ADP as tiebreaker.
  scored.sort((a, b) => b.vorp - a.vorp || a.adp - b.adp);
  scored.forEach((p, i) => {
    p.overallRank = i + 1;
  });

  return scored;
}

export const DATASET_PLAYER_COUNT = (raw as RawPlayer[]).length;
