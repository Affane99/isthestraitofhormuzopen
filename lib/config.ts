/**
 * Typed access to the editorial config committed at data/status-override.json.
 * The JSON is imported at build time: editing it + pushing a commit triggers
 * a Vercel redeploy, which is the intended editorial workflow.
 */
import raw from "@/data/status-override.json";
import type { Status } from "./status";

export interface ManualFacts {
  warRiskInsuranceMultiplier: string;
  majorCarriersSuspended: number;
  strandedVesselsApprox: number;
  centralChannelMined: boolean;
}

export interface EditorialConfig {
  override: Status | null;
  overrideReason: string | null;
  baselineTransitsPerDay: number;
  closureDeclaredOn: string;
  manualFacts: ManualFacts;
  funnySubtexts: Record<Status, string[]>;
}

const VALID_STATUSES = new Set(["OPEN", "COMPLICATED", "CLOSED"]);

// The JSON currently has `override: null`, so TypeScript infers a narrower
// type than the schema allows; widen it through the interface instead.
const parsed = raw as unknown as EditorialConfig;

/** A typo in the JSON must never crash the site — fall back to auto mode. */
const safeOverride: Status | null =
  parsed.override !== null && VALID_STATUSES.has(parsed.override)
    ? parsed.override
    : null;

export const editorialConfig: EditorialConfig = {
  ...parsed,
  override: safeOverride,
};
