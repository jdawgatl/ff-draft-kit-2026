import type { LeagueSettings } from '../types';

/**
 * Locked default settings for the user's 12-team Yahoo league, 2026 season.
 * Matches the league's "Scoring / Settings" page exactly.
 */
export const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  teams: 12,
  myPickSlot: 6,
  rounds: 18,
  rosterSlots: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 2, // W/R/T
    K: 1,
    DEF: 1,
    BENCH: 8,
    IR: 5,
  },
  scoring: {
    passing: {
      tdPts: 6,
      ydsPerPt: 25, // 0.04 pt/yd
      completionPts: 0.25,
      interceptionPts: -2,
      sackTakenPts: -1,
      milestones: [
        { yds: 300, pts: 5 },
        { yds: 400, pts: 5 },
        { yds: 500, pts: 5 },
      ],
    },
    rushing: {
      tdPts: 6,
      ydsPerPt: 10, // 0.1 pt/yd
      twoPtPts: 2,
      fumbleLostPts: -2,
      milestones: [
        { yds: 100, pts: 5 },
        { yds: 200, pts: 5 },
      ],
    },
    receiving: {
      receptionPts: 1.0, // Full PPR
      tdPts: 6,
      ydsPerPt: 10, // 0.1 pt/yd
      milestones: [
        { yds: 100, pts: 5 },
        { yds: 200, pts: 5 },
      ],
    },
    returns: {
      ydsPerPt: 35, // 0.0285 pt/yd
      tdPts: 6,
    },
    kicking: {
      fg0_39: 3,
      fg40_49: 4,
      fg50plus: 5,
      xp: 1,
    },
    defense: {
      sackPts: 1,
      turnoverPts: 2, // INT / fumble recovery
      safetyPts: 2,
      blockedKickPts: 2,
      tdPts: 6,
      pointsAllowedTiers: [
        { max: 0, pts: 25 },
        { max: 6, pts: 15 },
        { max: 13, pts: 10 },
        { max: 20, pts: 5 },
        { max: 27, pts: 0 },
        { max: 34, pts: -5 },
        { max: Infinity, pts: -10 },
      ],
    },
  },
};

/** All picks the user owns across every round, snake-draft order. */
export function computeMyPickNumbers(settings: LeagueSettings): number[] {
  const picks: number[] = [];
  for (let round = 1; round <= settings.rounds; round++) {
    const slot =
      round % 2 === 1 ? settings.myPickSlot : settings.teams - settings.myPickSlot + 1;
    picks.push((round - 1) * settings.teams + slot);
  }
  return picks;
}
