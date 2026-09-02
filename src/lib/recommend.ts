import type { LeagueSettings, Player, Position } from '../types';
import { survivalProbability } from './normal';

export interface RosterNeed {
  position: Position;
  starterSlotsRemaining: number; // dedicated slots (e.g. 2nd RB) still empty
  flexEligible: boolean;
  flexSlotsRemaining: number;
}

export function computeRosterNeeds(
  rosterPlayerIds: string[],
  allPlayers: Player[],
  settings: LeagueSettings
): Record<Position, RosterNeed> {
  const byId = new Map(allPlayers.map((p) => [p.id, p]));
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const id of rosterPlayerIds) {
    const p = byId.get(id);
    if (p) counts[p.position]++;
  }

  const { QB, RB, WR, TE, FLEX, K, DEF } = settings.rosterSlots;
  const flexUsed =
    Math.max(0, counts.RB - RB) + Math.max(0, counts.WR - WR) + Math.max(0, counts.TE - TE);
  const flexRemaining = Math.max(0, FLEX - flexUsed);

  const needs: Record<Position, RosterNeed> = {
    QB: { position: 'QB', starterSlotsRemaining: Math.max(0, QB - counts.QB), flexEligible: false, flexSlotsRemaining: 0 },
    RB: { position: 'RB', starterSlotsRemaining: Math.max(0, RB - counts.RB), flexEligible: true, flexSlotsRemaining: flexRemaining },
    WR: { position: 'WR', starterSlotsRemaining: Math.max(0, WR - counts.WR), flexEligible: true, flexSlotsRemaining: flexRemaining },
    TE: { position: 'TE', starterSlotsRemaining: Math.max(0, TE - counts.TE), flexEligible: true, flexSlotsRemaining: flexRemaining },
    K: { position: 'K', starterSlotsRemaining: Math.max(0, K - counts.K), flexEligible: false, flexSlotsRemaining: 0 },
    DEF: { position: 'DEF', starterSlotsRemaining: Math.max(0, DEF - counts.DEF), flexEligible: false, flexSlotsRemaining: 0 },
  };
  return needs;
}

export interface RecommendationScore {
  player: Player;
  score: number;
  reasons: string[];
  valueAlert: boolean;
  dontReach: boolean;
  tierDropoffRisk: boolean;
}

const ADP_REACH_THRESHOLD = 8; // picks
const ADP_VALUE_THRESHOLD = 8;

export function scoreAvailablePlayers(
  available: Player[],
  rosterPlayerIds: string[],
  allPlayers: Player[],
  settings: LeagueSettings,
  currentPickNumber: number,
  nextMyPickNumber: number | null
): RecommendationScore[] {
  const needs = computeRosterNeeds(rosterPlayerIds, allPlayers, settings);
  const maxVorp = Math.max(1, ...available.map((p) => p.vorp));

  // Tier drop-off: for each position, find how many players remain in the
  // current best available tier for that position.
  const byPosition: Record<Position, Player[]> = { QB: [], RB: [], WR: [], TE: [], K: [], DEF: [] };
  for (const p of available) byPosition[p.position].push(p);
  (Object.keys(byPosition) as Position[]).forEach((pos) =>
    byPosition[pos].sort((a, b) => a.tier - b.tier || b.vorp - a.vorp)
  );

  return available.map((player) => {
    const reasons: string[] = [];
    let score = (player.vorp / maxVorp) * 100;

    const need = needs[player.position];
    if (need.starterSlotsRemaining > 0) {
      score += 22;
      reasons.push(`Fills starting ${player.position} need`);
    } else if (need.flexEligible && need.flexSlotsRemaining > 0) {
      score += 12;
      reasons.push('Fills FLEX need');
    } else {
      score += 2;
    }

    // Tier scarcity: players in tier 1-2 with few same-tier peers left are
    // more urgent, especially if unlikely to survive to the user's next pick.
    const sameTierCount = byPosition[player.position].filter((p) => p.tier === player.tier).length;
    let tierDropoffRisk = false;
    if (player.tier <= 3 && sameTierCount <= 3) {
      score += 10;
      tierDropoffRisk = true;
      reasons.push(`Only ${sameTierCount} Tier ${player.tier} ${player.position}(s) left`);
    }

    if (nextMyPickNumber != null) {
      const survival = survivalProbability(player.adp, player.adpStdDev, nextMyPickNumber);
      if (survival < 0.4) {
        score += 8;
        reasons.push('Unlikely to be there next round');
      } else if (survival > 0.85 && need.starterSlotsRemaining === 0) {
        score -= 6;
        reasons.push('Safe to wait — likely available later');
      }
    }

    const valueAlert = currentPickNumber - player.adp >= ADP_VALUE_THRESHOLD;
    const dontReach = player.adp - currentPickNumber >= ADP_REACH_THRESHOLD;
    if (valueAlert) {
      score += 6;
      reasons.push(`Value: ADP ${Math.round(player.adp)} vs. pick ${currentPickNumber}`);
    }
    if (dontReach) {
      score -= 4;
      reasons.push(`Reach: ADP ${Math.round(player.adp)} vs. pick ${currentPickNumber}`);
    }

    return { player, score, reasons, valueAlert, dontReach, tierDropoffRisk };
  });
}

export function topRecommendations(
  available: Player[],
  rosterPlayerIds: string[],
  allPlayers: Player[],
  settings: LeagueSettings,
  currentPickNumber: number,
  nextMyPickNumber: number | null,
  count = 3
): RecommendationScore[] {
  const scored = scoreAvailablePlayers(
    available,
    rosterPlayerIds,
    allPlayers,
    settings,
    currentPickNumber,
    nextMyPickNumber
  );
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}
