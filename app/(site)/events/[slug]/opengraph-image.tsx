import { ImageResponse } from "next/og";
import { getEventBySlug } from "@/lib/events";
import { formatDay } from "@/lib/datetime";

export const alt = "Event on StageGrid";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  const live = e && e.status === "published" ? e : null;
  const title = live?.title ?? "StageGrid";
  const meta = live ? `${formatDay(live.startsAt, live.timezone, "long")} · ${live.location}` : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0e0d0b", color: "#efeae0", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 600 }}>
            <div style={{ width: 18, height: 18, background: "#ff5a2d", borderRadius: 4 }} />
            StageGrid
          </div>
          <div style={{ color: "#a39d92", textTransform: "uppercase", letterSpacing: 4, fontSize: 24 }}>{live?.category}</div>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 40 ? 78 : 100, lineHeight: 1.04, letterSpacing: -2, fontFamily: "Georgia, serif" }}>{title}</div>
        <div style={{ display: "flex", fontSize: 32, color: "#a39d92" }}>{meta}</div>
      </div>
    ),
    size,
  );
}
