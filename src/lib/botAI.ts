import type { LeagueSettings, Player } from '../types';
import { computeRosterNeeds } from './recommend';

/**
 * Simulated AI manager: blends ADP proximity, positional need, and player
 * value (VORP), then samples from the top candidates with weighted
 * randomness so mock drafts feel realistic rather than perfectly
 * ADP-deterministic.
 */
export function pickForBot(
  botRosterIds: string[],
  available: Player[],
  allPlayers: Player[],
  settings: LeagueSettings,
  pickNumber: number
): Player {
  if (available.length === 0) throw new Error('No available players to draft');

  const needs = computeRosterNeeds(botRosterIds, allPlayers, settings);
  const maxVorp = Math.max(1, ...available.map((p) => p.vorp));

  // Bots won't consider K/DEF until the board thins out or it's late enough.
  const roundEstimate = Math.ceil(pickNumber / settings.teams);
  const pool = available.filter((p) => {
    if ((p.position === 'K' || p.position === 'DEF') && roundEstimate < settings.rounds - 3) {
      return false;
    }
    return true;
  });
  const candidates = (pool.length ? pool : available).slice(0, 60);

  const scored = candidates.map((player) => {
    const vorpComponent = (player.vorp / maxVorp) * 55;

    const need = needs[player.position];
    let needComponent = 4;
    if (need.starterSlotsRemaining > 0) needComponent = 28;
    else if (need.flexEligible && need.flexSlotsRemaining > 0) needComponent = 14;

    const adpDelta = Math.abs(player.adp - pickNumber);
    const adpProximity = Math.max(0, 20 - adpDelta * 0.35);

    const noise = (Math.random() - 0.5) * 14; // pick variance

    return { player, score: vorpComponent + needComponent + adpProximity + noise };
  });

  scored.sort((a, b) => b.score - a.score);

  // Weighted sample from the top 5 so it's not perfectly deterministic.
  const top = scored.slice(0, 5);
  const weights = top.map((_, i) => 1 / (i + 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i].player;
  }
  return top[0].player;
}
