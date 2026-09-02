import type { ScoringSettings, StatLine } from '../types';

function milestoneBonus(yds: number, milestones: { yds: number; pts: number }[]): number {
  let bonus = 0;
  for (const m of milestones) {
    if (yds >= m.yds) bonus += m.pts;
  }
  return bonus;
}

function pointsAllowedScore(
  pointsAllowed: number,
  tiers: { max: number; pts: number }[]
): number {
  for (const tier of tiers) {
    if (pointsAllowed <= tier.max) return tier.pts;
  }
  return tiers[tiers.length - 1].pts;
}

/**
 * Computes total fantasy points for a full-season StatLine under the
 * league's exact custom scoring rules.
 */
export function calculateFantasyPoints(stats: StatLine, scoring: ScoringSettings): number {
  let pts = 0;

  // Passing
  if (stats.passYds) pts += stats.passYds / scoring.passing.ydsPerPt;
  if (stats.passTd) pts += stats.passTd * scoring.passing.tdPts;
  if (stats.passCmp) pts += stats.passCmp * scoring.passing.completionPts;
  if (stats.passInt) pts += stats.passInt * scoring.passing.interceptionPts;
  if (stats.sacksTaken) pts += stats.sacksTaken * scoring.passing.sackTakenPts;
  if (stats.passYds) pts += milestoneBonus(stats.passYds, scoring.passing.milestones);

  // Rushing
  if (stats.rushYds) pts += stats.rushYds / scoring.rushing.ydsPerPt;
  if (stats.rushTd) pts += stats.rushTd * scoring.rushing.tdPts;
  if (stats.twoPtConv) pts += stats.twoPtConv * scoring.rushing.twoPtPts;
  if (stats.rushFumLost) pts += stats.rushFumLost * scoring.rushing.fumbleLostPts;
  if (stats.rushYds) pts += milestoneBonus(stats.rushYds, scoring.rushing.milestones);

  // Receiving
  if (stats.rec) pts += stats.rec * scoring.receiving.receptionPts;
  if (stats.recTd) pts += stats.recTd * scoring.receiving.tdPts;
  if (stats.recYds) pts += stats.recYds / scoring.receiving.ydsPerPt;
  if (stats.recYds) pts += milestoneBonus(stats.recYds, scoring.receiving.milestones);

  // Returns
  const retYds = (stats.kickRetYds ?? 0) + (stats.puntRetYds ?? 0);
  if (retYds) pts += retYds / scoring.returns.ydsPerPt;
  const retTd = (stats.kickRetTd ?? 0) + (stats.puntRetTd ?? 0);
  if (retTd) pts += retTd * scoring.returns.tdPts;

  // Kicking
  if (stats.fg0_39) pts += stats.fg0_39 * scoring.kicking.fg0_39;
  if (stats.fg40_49) pts += stats.fg40_49 * scoring.kicking.fg40_49;
  if (stats.fg50plus) pts += stats.fg50plus * scoring.kicking.fg50plus;
  if (stats.xpMade) pts += stats.xpMade * scoring.kicking.xp;

  // Defense / Special Teams
  if (stats.defSacks) pts += stats.defSacks * scoring.defense.sackPts;
  if (stats.defInt) pts += stats.defInt * scoring.defense.turnoverPts;
  if (stats.defFumRec) pts += stats.defFumRec * scoring.defense.turnoverPts;
  if (stats.defSafety) pts += stats.defSafety * scoring.defense.safetyPts;
  if (stats.defBlockKick) pts += stats.defBlockKick * scoring.defense.blockedKickPts;
  if (stats.defTd) pts += stats.defTd * scoring.defense.tdPts;
  if (stats.pointsAllowedPerGame != null) {
    // Points-allowed tiers are scored per game in Yahoo; multiply by a 17-game season.
    const perGame = pointsAllowedScore(
      stats.pointsAllowedPerGame,
      scoring.defense.pointsAllowedTiers
    );
    pts += perGame * 17;
  }

  return Math.round(pts * 100) / 100;
}
