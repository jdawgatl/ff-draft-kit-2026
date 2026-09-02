/** Standard normal CDF via Abramowitz & Stegun erf approximation. */
export function normalCdf(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return x >= mean ? 1 : 0;
  const z = (x - mean) / (stdDev * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26, max error ~1.5e-7
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Probability a player with the given ADP distribution N(adp, stdDev)
 * is still on the board at `targetPick` (i.e. their simulated draft
 * position is greater than or equal to targetPick).
 */
export function survivalProbability(
  adp: number,
  stdDev: number,
  targetPick: number
): number {
  const p = 1 - normalCdf(targetPick, adp, stdDev);
  return Math.max(0, Math.min(1, p));
}
