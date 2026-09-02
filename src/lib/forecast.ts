import type { AvailabilityForecast, Player } from '../types';
import { survivalProbability } from './normal';

/**
 * For every future pick the user owns, computes the probability each
 * undrafted player of interest survives to that pick, using their ADP
 * as a normal distribution's mean and adpStdDev as its spread.
 */
export function computeAvailabilityForecast(
  players: Player[],
  myFuturePickNumbers: number[],
  currentPickNumber: number
): Map<string, AvailabilityForecast[]> {
  const result = new Map<string, AvailabilityForecast[]>();
  const upcoming = myFuturePickNumbers.filter((n) => n >= currentPickNumber);

  for (const player of players) {
    const forecasts: AvailabilityForecast[] = upcoming.map((pickNumber) => {
      const prob = survivalProbability(player.adp, player.adpStdDev, pickNumber);
      const label: AvailabilityForecast['label'] =
        prob > 0.7 ? 'likely' : prob >= 0.4 ? 'tossup' : 'unlikely';
      return {
        playerId: player.id,
        pickNumber,
        picksUntil: pickNumber - currentPickNumber,
        survivalProbability: prob,
        label,
      };
    });
    result.set(player.id, forecasts);
  }

  return result;
}

/** Convenience: survival probability to the *next* pick the user owns. */
export function survivalToNextPick(
  player: Player,
  nextMyPickNumber: number
): number {
  return survivalProbability(player.adp, player.adpStdDev, nextMyPickNumber);
}
