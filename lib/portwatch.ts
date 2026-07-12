/**
 * IMF PortWatch adapter — fetches the latest daily transit count for the
 * Strait of Hormuz (PortWatch id "chokepoint6").
 *
 * Endpoint VERIFIED LIVE on 2026-07-12 against the PortWatch ArcGIS org
 * (services9.arcgis.com/weJ1QsnbMYJlCHdG). Exact query:
 *
 *   GET https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query
 *     ?where=portid='chokepoint6'
 *     &outFields=date,portid,portname,n_total
 *     &orderByFields=date DESC
 *     &resultRecordCount=7
 *     &f=json
 *
 * Verified response shape (layer 0 is a Table; `date` is an
 * esriFieldTypeDateOnly field serialized as a "YYYY-MM-DD" string):
 *
 *   { "features": [ { "attributes": {
 *       "date": "2026-07-05", "portid": "chokepoint6",
 *       "portname": "Strait of Hormuz", "n_total": 34 } }, ... ] }
 *
 * On error the layer still returns HTTP 200 with an { "error": ... } body,
 * so both are handled below. PortWatch publishes with a ~5-7 day lag; we
 * request the last 7 records and use the most recent one with a usable
 * n_total, and the UI always displays the data date honestly.
 */

const PORTWATCH_QUERY_URL =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query?" +
  new URLSearchParams({
    where: "portid='chokepoint6'",
    outFields: "date,portid,portname,n_total",
    orderByFields: "date DESC",
    resultRecordCount: "7",
    f: "json",
  }).toString();

export interface TransitData {
  /** Ships per day (PortWatch `n_total`). */
  transitsPerDay: number;
  /** Date of the data point, "YYYY-MM-DD". */
  dataDate: string;
  /** Where the numbers came from: live API, in-memory cache, or repo fallback. */
  source: "portwatch" | "cache" | "fallback";
}

/**
 * Last verified PortWatch figure committed to the repo, used when the API is
 * unreachable and no cached response exists (e.g. cold start while offline).
 */
export const STATIC_FALLBACK: TransitData = {
  transitsPerDay: 34,
  dataDate: "2026-07-05",
  source: "fallback",
};

interface ArcgisAttributes {
  date?: unknown;
  n_total?: unknown;
}

interface ArcgisQueryResponse {
  features?: { attributes?: ArcgisAttributes }[];
  error?: { code?: number; message?: string };
}

/** Last successful API response, kept for the lifetime of the server process. */
let lastGood: TransitData | null = null;

export async function fetchHormuzTransits(): Promise<TransitData> {
  try {
    const res = await fetch(PORTWATCH_QUERY_URL, {
      // ISR: Next.js caches this fetch and revalidates it at most hourly.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new Error(`PortWatch responded with HTTP ${res.status}`);
    }

    const json = (await res.json()) as ArcgisQueryResponse;
    if (json.error) {
      throw new Error(
        `PortWatch/ArcGIS error ${json.error.code ?? "?"}: ${json.error.message ?? "unknown"}`,
      );
    }
    if (!Array.isArray(json.features)) {
      throw new Error("PortWatch response has no features array");
    }

    // Records come back date DESC; take the newest one that is usable.
    for (const feature of json.features) {
      const date = feature.attributes?.date;
      const nTotal = feature.attributes?.n_total;
      if (typeof date === "string" && typeof nTotal === "number") {
        lastGood = { transitsPerDay: nTotal, dataDate: date, source: "portwatch" };
        return lastGood;
      }
    }
    throw new Error("PortWatch returned no usable chokepoint6 records");
  } catch (err) {
    console.error("[portwatch] fetch failed, serving last known values:", err);
    if (lastGood) {
      return { ...lastGood, source: "cache" };
    }
    return STATIC_FALLBACK;
  }
}
