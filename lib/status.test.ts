import { describe, expect, it } from "vitest";
import {
  CLOSED_MAX_RATIO,
  computeStatus,
  daysSince,
  OPEN_MIN_RATIO,
  pickSubtext,
  STALE_THRESHOLD_DAYS,
} from "./status";

const BASELINE = 88;

describe("computeStatus — thresholds", () => {
  it("returns OPEN when ratio is above 0.70", () => {
    const result = computeStatus(80, BASELINE, null); // ratio ≈ 0.91
    expect(result.status).toBe("OPEN");
    expect(result.source).toBe("computed");
    expect(result.stale).toBe(false);
    expect(result.error).toBe(false);
  });

  it("returns COMPLICATED when ratio is between 0.20 and 0.70", () => {
    const result = computeStatus(34, BASELINE, null); // ratio ≈ 0.39
    expect(result.status).toBe("COMPLICATED");
    expect(result.ratio).toBeCloseTo(34 / 88);
  });

  it("returns CLOSED when ratio is below 0.20", () => {
    const result = computeStatus(10, BASELINE, null); // ratio ≈ 0.11
    expect(result.status).toBe("CLOSED");
  });

  it("treats ratio exactly 0.70 as OPEN (boundary is inclusive)", () => {
    const result = computeStatus(70, 100, null);
    expect(result.ratio).toBe(OPEN_MIN_RATIO);
    expect(result.status).toBe("OPEN");
  });

  it("treats ratio exactly 0.20 as COMPLICATED (boundary is inclusive)", () => {
    const result = computeStatus(20, 100, null);
    expect(result.ratio).toBe(CLOSED_MAX_RATIO);
    expect(result.status).toBe("COMPLICATED");
  });

  it("treats ratio just below 0.70 as COMPLICATED", () => {
    expect(computeStatus(69, 100, null).status).toBe("COMPLICATED");
  });

  it("treats ratio just below 0.20 as CLOSED", () => {
    expect(computeStatus(19, 100, null).status).toBe("CLOSED");
  });
});

describe("computeStatus — override", () => {
  it("returns the override with source editorial, ignoring the ratio", () => {
    const result = computeStatus(80, BASELINE, "CLOSED"); // ratio would say OPEN
    expect(result.status).toBe("CLOSED");
    expect(result.source).toBe("editorial");
    expect(result.stale).toBe(false);
  });

  it("wins even when data is stale or missing", () => {
    const result = computeStatus(null, BASELINE, "OPEN", null);
    expect(result.status).toBe("OPEN");
    expect(result.source).toBe("editorial");
    expect(result.stale).toBe(false);
  });

  it("keeps the computed ratio available for display", () => {
    const result = computeStatus(34, BASELINE, "CLOSED");
    expect(result.ratio).toBeCloseTo(34 / 88);
  });
});

describe("computeStatus — stale data", () => {
  it("flags stale when transits are unavailable", () => {
    const result = computeStatus(null, BASELINE, null);
    expect(result.status).toBe("COMPLICATED");
    expect(result.stale).toBe(true);
  });

  it("flags stale when data age is unknown", () => {
    const result = computeStatus(34, BASELINE, null, null);
    expect(result.status).toBe("COMPLICATED");
    expect(result.stale).toBe(true);
  });

  it("flags stale when data is older than the threshold", () => {
    const result = computeStatus(34, BASELINE, null, STALE_THRESHOLD_DAYS + 1);
    expect(result.status).toBe("COMPLICATED");
    expect(result.stale).toBe(true);
  });

  it("does not flag stale at exactly the threshold", () => {
    const result = computeStatus(34, BASELINE, null, STALE_THRESHOLD_DAYS);
    expect(result.stale).toBe(false);
    expect(result.status).toBe("COMPLICATED"); // from the ratio, not staleness
  });
});

describe("computeStatus — degenerate inputs", () => {
  it("returns CLOSED for zero transits", () => {
    const result = computeStatus(0, BASELINE, null);
    expect(result.status).toBe("CLOSED");
    expect(result.ratio).toBe(0);
    expect(result.error).toBe(false);
  });

  it("returns CLOSED with the error flag for a zero baseline", () => {
    const result = computeStatus(34, 0, null);
    expect(result.status).toBe("CLOSED");
    expect(result.error).toBe(true);
    expect(result.ratio).toBeNull();
  });

  it("returns CLOSED with the error flag for a negative baseline", () => {
    const result = computeStatus(34, -5, null);
    expect(result.status).toBe("CLOSED");
    expect(result.error).toBe(true);
  });
});

describe("daysSince", () => {
  const now = new Date("2026-07-12T10:00:00Z");

  it("counts whole days elapsed since a UTC date", () => {
    expect(daysSince("2026-07-05", now)).toBe(7);
  });

  it("returns 0 for today", () => {
    expect(daysSince("2026-07-12", now)).toBe(0);
  });

  it("counts the closure declaration correctly", () => {
    expect(daysSince("2026-02-28", now)).toBe(134);
  });

  it("returns null for garbage input", () => {
    expect(daysSince("not-a-date", now)).toBeNull();
  });
});

describe("pickSubtext", () => {
  const lines = ["first {N}", "second", "third {N} and {N}"];

  it("picks deterministically with an injected random", () => {
    expect(pickSubtext(lines, 5, () => 0)).toBe("first 5");
    expect(pickSubtext(lines, 5, () => 0.5)).toBe("second");
  });

  it("substitutes every {N} occurrence", () => {
    expect(pickSubtext(lines, 12, () => 0.99)).toBe("third 12 and 12");
  });

  it("never overflows the array even when random returns 1", () => {
    expect(pickSubtext(lines, 1, () => 1)).toBe("third 1 and 1");
  });

  it("returns null for an empty list", () => {
    expect(pickSubtext([], 1)).toBeNull();
  });
});
