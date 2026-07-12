import { ImageResponse } from "next/og";
import { editorialConfig } from "@/lib/config";
import { fetchHormuzTransits } from "@/lib/portwatch";
import { computeStatus, daysSince, type Status } from "@/lib/status";

export const alt = "Is the Strait of Hormuz open? Live status.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const WORD: Record<Status, string> = {
  OPEN: "YES.",
  COMPLICATED: "SORT OF.",
  CLOSED: "NO.",
};

const BACKGROUND: Record<Status, string> = {
  OPEN: "#16a34a",
  COMPLICATED: "#d97706",
  CLOSED: "#dc2626",
};

export default async function OpengraphImage() {
  const transit = await fetchHormuzTransits();
  const dataAgeDays = daysSince(transit.dataDate);
  const result = computeStatus(
    transit.transitsPerDay,
    editorialConfig.baselineTransitsPerDay,
    editorialConfig.override,
    dataAgeDays,
  );
  const daysSinceClosure = daysSince(editorialConfig.closureDeclaredOn) ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BACKGROUND[result.status],
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 38, opacity: 0.9 }}>
          Is the Strait of Hormuz open?
        </div>
        <div
          style={{
            fontSize: result.status === "COMPLICATED" ? 190 : 240,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -6,
            marginTop: 20,
          }}
        >
          {WORD[result.status]}
        </div>
        {result.status !== "OPEN" && (
          <div style={{ fontSize: 32, opacity: 0.9, marginTop: 28 }}>
            {`Day ${daysSinceClosure} since the closure declaration`}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            fontSize: 24,
            opacity: 0.75,
          }}
        >
          {`${transit.transitsPerDay} ships/day vs ~${editorialConfig.baselineTransitsPerDay} normal · IMF PortWatch`}
        </div>
      </div>
    ),
    { ...size },
  );
}
