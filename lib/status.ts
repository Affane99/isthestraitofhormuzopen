/**
 * Pure status logic for "Is the Strait of Hormuz Open?".
 * No I/O in this module — everything is deterministic and unit-tested.
 */

export type Status = "OPEN" | "COMPLICATED" | "CLOSED";

export interface StatusResult {
  status: Status;
  /** "editorial" when the manual override in data/status-override.json won. */
  source: "editorial" | "computed";
  /** transits / baseline, or null when it cannot be computed. */
  ratio: number | null;
  /** True when transit data is missing or older than STALE_THRESHOLD_DAYS. */
  stale: boolean;
  /** True when the inputs were unusable (baseline ≤ 0 → division by zero). */
  error: boolean;
}

/** ratio ≥ 0.70 → OPEN */
export const OPEN_MIN_RATIO = 0.7;
/** ratio < 0.20 → CLOSED (0.20 ≤ ratio < 0.70 → COMPLICATED) */
export const CLOSED_MAX_RATIO = 0.2;
/** Data older than this is treated as unreliable. */
export const STALE_THRESHOLD_DAYS = 14;

/**
 * Decide the strait's status.
 *
 * @param transits    Latest daily transit count from PortWatch, or null when unavailable.
 * @param baseline    Pre-crisis baseline (ships/day).
 * @param override    Editorial override; when non-null it always wins.
 * @param dataAgeDays Age of the transit data point in days, or null when unknown.
 */
export function computeStatus(
  transits: number | null,
  baseline: number,
  override: Status | null,
  dataAgeDays: number | null = 0,
): StatusResult {
  const ratio =
    transits !== null && baseline > 0 ? transits / baseline : null;

  if (override !== null) {
    return { status: override, source: "editorial", ratio, stale: false, error: false };
  }

  if (transits === null || dataAgeDays === null || dataAgeDays > STALE_THRESHOLD_DAYS) {
    return { status: "COMPLICATED", source: "computed", ratio, stale: true, error: false };
  }

  if (baseline <= 0) {
    return { status: "CLOSED", source: "computed", ratio: null, stale: false, error: true };
  }

  const r = transits / baseline;
  const status: Status =
    r >= OPEN_MIN_RATIO ? "OPEN" : r >= CLOSED_MAX_RATIO ? "COMPLICATED" : "CLOSED";
  return { status, source: "computed", ratio: r, stale: false, error: false };
}

/**
 * Whole days elapsed between an ISO date (YYYY-MM-DD, interpreted as UTC
 * midnight) and `now`. Returns null for unparseable dates.
 */
export function daysSince(isoDate: string, now: Date = new Date()): number | null {
  const then = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/**
 * Pick one subtext line and substitute the {N} day-counter placeholder.
 * `random` is injectable for tests; defaults to Math.random.
 */
export function pickSubtext(
  lines: readonly string[],
  dayCount: number,
  random: () => number = Math.random,
): string | null {
  if (lines.length === 0) return null;
  const index = Math.min(Math.floor(random() * lines.length), lines.length - 1);
  return lines[index].replaceAll("{N}", String(dayCount));
}
