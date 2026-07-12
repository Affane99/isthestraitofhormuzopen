# Is the Strait of Hormuz Open?

A single-purpose website in the spirit of isitchristmas.com. It answers exactly
one question — **is the Strait of Hormuz open to commercial traffic?** — with a
giant verdict, a dry one-liner, and a handful of real numbers underneath for
credibility. It is deliberately the *anti-dashboard*: if you want charts and
maps, this is not that site.

- **YES.** (green) · **SORT OF.** (amber) · **NO.** (red)
- Data: [IMF PortWatch](https://portwatch.imf.org) daily chokepoint transits
- Stack: Next.js 15 (App Router) · TypeScript strict · Tailwind CSS v4 · Vercel

## How the status is computed

The logic lives in [`lib/status.ts`](lib/status.ts) — a pure module with full
unit-test coverage ([`lib/status.test.ts`](lib/status.test.ts)).

```
computeStatus(transits, baseline, override, dataAgeDays)
```

1. **Editorial override first.** If `override` in
   [`data/status-override.json`](data/status-override.json) is non-null, it
   wins unconditionally (`source: "editorial"`).
2. **Staleness.** If transit data is unavailable, or the latest data point is
   older than **14 days** (`STALE_THRESHOLD_DAYS`), the status is
   `COMPLICATED` with `stale: true` and the site says
   "Honestly? Even we're not sure right now." alongside the last known figure.
3. **Otherwise, ratio = transits / baseline** (baseline ≈ 88 ships/day pre-crisis):

   | Ratio               | Status        | Verdict    |
   | ------------------- | ------------- | ---------- |
   | ratio ≥ 0.70        | `OPEN`        | YES.       |
   | 0.20 ≤ ratio < 0.70 | `COMPLICATED` | SORT OF.   |
   | ratio < 0.20        | `CLOSED`      | NO.        |

   A baseline of 0 (division by zero) yields `CLOSED` with `error: true`.

Run the tests:

```bash
npm test
```

## Data source: IMF PortWatch

[`lib/portwatch.ts`](lib/portwatch.ts) queries the PortWatch ArcGIS layer
**`Daily_Chokepoints_Data`** (the Strait of Hormuz is `chokepoint6`). The exact
query — verified live against the API on 2026-07-12 — is documented in a
comment at the top of that file, including the real response schema.

Notes:

- PortWatch publishes with a **5–7 day lag**; the site always displays the
  data date honestly ("Last verified data: July 5, 2026").
- The fetch uses ISR (`next: { revalidate: 3600 }`), so PortWatch is hit at
  most once an hour.
- On any fetch error the adapter falls back to the last successful response
  held in memory, then to a static fallback committed in the repo
  (34 transits on 2026-07-05).

## Editorial override (when the news moves faster than the data)

Edit [`data/status-override.json`](data/status-override.json) and push a
commit — Vercel redeploys automatically:

```jsonc
{
  "override": "CLOSED",            // null | "OPEN" | "COMPLICATED" | "CLOSED"
  "overrideReason": "New strikes reported; PortWatch lagging.",
  ...
}
```

Set `override` back to `null` to return to the automatic calculation. The same
file holds the manually curated figures shown in the cards (`manualFacts`:
war-risk insurance multiplier, suspended carriers, stranded vessels, mined
central channel) — nothing on the site is invented, every number comes from
PortWatch or this file.

### Fresher-than-PortWatch figures: `reportedTransits`

PortWatch is the *verified* series but publishes with a ~5–7 day lag. When
credible fresher numbers exist (UKMTO/JMIC figures relayed by the press),
put them in `reportedTransits`:

```jsonc
"reportedTransits": {
  "range": "11–17",         // shown as "~11–17 ships/day"
  "midpoint": 14,            // drives the progress bar
  "asOf": "2026-07-10",     // shown next to the figure
  "source": "JMIC/UKMTO figures via press reports"
}
```

The Transits card then leads with the reported figure (dated, labeled
"reported") and demotes the verified figure to a footnote. The block is
ignored automatically as soon as PortWatch catches up (`asOf` older than the
latest verified data point), and can be set to `null` to disable it manually.

### Adding funny subtexts

Add lines to the `funnySubtexts` arrays (the pool currently holds ~13 per
status). One is picked at random server-side on each regeneration — the page
regenerates hourly, so the line rotates through the day. `{N}` is replaced
with the day count since the closure declaration.

**The red line:** jokes target geopolitical and bureaucratic absurdity —
never stranded seafarers, casualties, or nationalities.

## Refresh & cron

The page regenerates hourly via ISR. To force it sooner:

```bash
curl -X POST https://<your-domain>/api/refresh \
  -H "Authorization: Bearer $REFRESH_SECRET"
```

- **`REFRESH_SECRET`** — set it in Vercel (Project → Settings → Environment
  Variables). Any long random string, e.g. `openssl rand -hex 32`.
- **Vercel Cron** — [`vercel.json`](vercel.json) schedules a call to
  `/api/refresh` once a day (06:00 UTC): the Hobby plan caps crons at daily,
  and hourly ISR does the real freshness work anyway. Vercel Cron sends
  **GET** requests and, when a **`CRON_SECRET`** env var exists, adds
  `Authorization: Bearer $CRON_SECRET` automatically — so also set
  `CRON_SECRET` in Vercel. The route accepts either secret and fails closed
  (401) when none is configured.
- Want the original 6-hourly cadence on the free plan? Use a GitHub Actions
  cron hitting the same endpoint with `REFRESH_SECRET` (or upgrade to Pro and
  restore `0 */6 * * *` in `vercel.json`).

All environment variables are documented in [`.env.example`](.env.example).
No API keys are needed — PortWatch is public.

## Analytics

The site uses [Vercel Web Analytics](https://vercel.com/docs/analytics) —
anonymous and cookie-less (no consent banner needed). Visitors and page views
appear in the Vercel dashboard under **Project → Analytics**. It was enabled
with `vercel project web-analytics`; the client side is the `<Analytics />`
component in [`app/layout.tsx`](app/layout.tsx).

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest — status logic
npm run lint    # ESLint
npm run build   # production build
```

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel (free plan is fine).
2. Set `REFRESH_SECRET`, `CRON_SECRET`, and optionally `NEXT_PUBLIC_SITE_URL`
   (your canonical URL, used for metadata/sitemap/robots).
3. Update `GITHUB_URL` in [`lib/site.ts`](lib/site.ts) to your repo URL.

## Disclaimer

This site is for general information and mild amusement. It is **not**
navigational, insurance, or trading advice. Mariners: consult official
maritime advisories.
