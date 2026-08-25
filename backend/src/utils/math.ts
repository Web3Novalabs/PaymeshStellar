/**
 * Math utilities for PaymeshStellar
 */

/**
 * Converts a percentage (e.g., 50.5555) to basis points (e.g., 5056)
 *
 * Rounding Rule: We round to the nearest integer basis point (Math.round),
 * as the contract only supports integer basis points up to 10000 (which is 100%).
 *
 * @param percent The percentage (can have up to 4 decimal places as per NUMERIC(7,4))
 * @returns basis points (integer)
 */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/**
 * Converts basis points (e.g., 5056) to a percentage string with 4 decimal places (e.g., "50.5600").
 * The return value matches the NUMERIC(7,4) string format from Postgres,
 * avoiding floating-point inaccuracies during comparisons.
 *
 * @param bps The basis points (integer)
 * @returns percentage as a string formatted to 4 decimal places
 */
export function bpsToPercent(bps: number): string {
  // 1 bps = 0.01%
  const percent = bps / 100;
  return percent.toFixed(4);
}
