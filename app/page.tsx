import type { Metadata } from "next";
import ShareButton from "@/components/ShareButton";
import { editorialConfig } from "@/lib/config";
import { fetchHormuzTransits, type TransitData } from "@/lib/portwatch";
import {
  computeStatus,
  daysSince,
  pickSubtext,
  type Status,
  type StatusResult,
} from "@/lib/status";
import { GITHUB_URL, SITE_NAME } from "@/lib/site";

/** ISR: the whole page regenerates at most hourly (plus /api/refresh on demand). */
export const revalidate = 3600;

const VERDICT_WORD: Record<Status, string> = {
  OPEN: "YES.",
  COMPLICATED: "SORT OF.",
  CLOSED: "NO.",
};

const TITLE_WORD: Record<Status, string> = {
  OPEN: "YES",
  COMPLICATED: "SORT OF",
  CLOSED: "NO",
};

const STATUS_COLOR: Record<Status, string> = {
  OPEN: "#16a34a",
  COMPLICATED: "#d97706",
  CLOSED: "#dc2626",
};

async function getVerdict() {
  const transit = await fetchHormuzTransits();
  const dataAgeDays = daysSince(transit.dataDate);
  const result = computeStatus(
    transit.transitsPerDay,
    editorialConfig.baselineTransitsPerDay,
    editorialConfig.override,
    dataAgeDays,
  );
  const daysSinceClosure = daysSince(editorialConfig.closureDeclaredOn) ?? 0;
  return { transit, result, daysSinceClosure };
}

function formatDate(iso: string): string {
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function plainAnswer(result: StatusResult, transit: TransitData): string {
  const lead: Record<Status, string> = {
    OPEN: "Yes, the Strait of Hormuz is currently open to commercial traffic.",
    COMPLICATED:
      "Sort of. The Strait of Hormuz is partially open: ships are moving, but well below normal levels and only on restricted routes.",
    CLOSED:
      "No, the Strait of Hormuz is effectively closed to normal commercial traffic.",
  };
  return `${lead[result.status]} Latest verified IMF PortWatch data (${formatDate(
    transit.dataDate,
  )}): ${transit.transitsPerDay} ship transits per day versus a pre-crisis baseline of about ${
    editorialConfig.baselineTransitsPerDay
  }.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const { transit, result } = await getVerdict();
  const title = `Is the Strait of Hormuz Open? ${TITLE_WORD[result.status]} — Live Status`;
  const description = `Current answer: ${TITLE_WORD[result.status]}. Latest verified IMF PortWatch data (${formatDate(
    transit.dataDate,
  )}): ${transit.transitsPerDay} ships/day vs ~${
    editorialConfig.baselineTransitsPerDay
  } before the crisis.`;
  return {
    title,
    description,
    openGraph: { title, description, url: "/", siteName: SITE_NAME, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page() {
  const { transit, result, daysSinceClosure } = await getVerdict();
  const { baselineTransitsPerDay, manualFacts, funnySubtexts } = editorialConfig;
  const color = STATUS_COLOR[result.status];

  const subtext = result.stale
    ? "Honestly? Even we're not sure right now."
    : (pickSubtext(funnySubtexts[result.status], daysSinceClosure) ?? "");

  const ratioPercent =
    result.ratio !== null ? Math.min(100, Math.round(result.ratio * 100)) : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is the Strait of Hormuz open?",
        acceptedAnswer: { "@type": "Answer", text: plainAnswer(result, transit) },
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1 — The verdict */}
      <section className="relative flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <p className="text-lg text-muted">Is the Strait of Hormuz open?</p>
        <h1 className="verdict font-extrabold" style={{ color }}>
          {VERDICT_WORD[result.status]}
        </h1>
        <p className="mt-6 max-w-xl text-xl italic text-muted">{subtext}</p>
        {result.source === "editorial" && editorialConfig.overrideReason && (
          <p className="mt-4 max-w-xl text-sm text-muted">
            Editors’ note — {editorialConfig.overrideReason}
          </p>
        )}
        {result.stale && (
          <p className="mt-3 text-sm text-muted">
            Last known data: {transit.transitsPerDay} ships/day on{" "}
            {formatDate(transit.dataDate)}.
          </p>
        )}
        {result.status !== "OPEN" && (
          <p className="mt-10 text-sm tracking-wide text-muted">
            Day {daysSinceClosure} since the closure declaration (Feb 28, 2026)
          </p>
        )}
        <a
          href="#numbers"
          className="chevron absolute bottom-7 text-muted"
          aria-label="Scroll down to the numbers"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </a>
      </section>

      {/* 2 — The actual numbers */}
      <section id="numbers" className="border-t border-line bg-surface px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">
            The actual numbers
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-line p-5">
              <p className="text-sm text-muted">Transits</p>
              <p className="mt-2 text-3xl font-bold">
                {transit.transitsPerDay}
                <span className="text-base font-normal text-muted"> ships/day</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                vs ~{baselineTransitsPerDay} normal
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${ratioPercent}%`, backgroundColor: color }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-line p-5">
              <p className="text-sm text-muted">War-risk insurance</p>
              <p className="mt-2 text-3xl font-bold">
                {manualFacts.warRiskInsuranceMultiplier}
              </p>
              <p className="mt-1 text-sm text-muted">the pre-crisis price</p>
            </div>

            <div className="rounded-lg border border-line p-5">
              <p className="text-sm text-muted">Major carriers</p>
              <p className="mt-2 text-3xl font-bold">
                {manualFacts.majorCarriersSuspended}
                <span className="text-base font-normal text-muted"> of 9</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                largest carriers have suspended or rerouted via the Cape
              </p>
            </div>

            <div className="rounded-lg border border-line p-5">
              <p className="text-sm text-muted">Last verified data</p>
              <p className="mt-2 text-3xl font-bold">{formatDate(transit.dataDate)}</p>
              <p className="mt-1 text-sm text-muted">
                IMF PortWatch
                {transit.source !== "portwatch" && " · last cached figure"}
                {" · published with a ~5–7 day lag"}
              </p>
            </div>
          </div>

          <details className="group mt-10">
            <summary className="cursor-pointer text-base font-medium underline decoration-line underline-offset-4 hover:decoration-muted">
              {"Why ‘sort of’ is a legitimate answer →"}
            </summary>
            <div className="mt-4 max-w-2xl space-y-3 text-base leading-relaxed text-muted">
              <p>
                The central channel — the deep-water route large tankers normally use —
                {manualFacts.centralChannelMined
                  ? " has been mined since late February and remains formally closed."
                  : " has reopened, though clearance operations continue."}
              </p>
              <p>
                The northern route through Iranian territorial waters technically
                functions, but only under an Iranian permit system that can be granted,
                delayed, or revoked without notice.
              </p>
              <p>
                The southern route hugs Omani waters under US Navy coordination, which
                is why roughly {manualFacts.strandedVesselsApprox} vessels have been
                waiting at regional anchorages at the last count.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* 3 — Footer */}
      <footer className="border-t border-line px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center text-sm text-muted">
          <ShareButton />
          <p className="max-w-xl">
            This site is for general information and mild amusement. It is NOT
            navigational, insurance, or trading advice. Mariners: consult official
            maritime advisories.
          </p>
          <p>
            Data:{" "}
            <a
              href="https://portwatch.imf.org"
              className="underline underline-offset-4 hover:text-foreground"
              rel="noopener noreferrer"
              target="_blank"
            >
              IMF PortWatch
            </a>{" "}
            · Status logic is{" "}
            <a
              href={GITHUB_URL}
              className="underline underline-offset-4 hover:text-foreground"
              rel="noopener noreferrer"
              target="_blank"
            >
              open source
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
