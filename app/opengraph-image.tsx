import { ImageResponse } from "next/og";

export const alt = "StageGrid — developer events worth showing up for";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0e0d0b", color: "#efeae0", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 600 }}>
          <div style={{ width: 20, height: 20, background: "#ff5a2d", borderRadius: 4 }} />
          StageGrid
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 108, lineHeight: 1.02, letterSpacing: -3, fontFamily: "Georgia, serif" }}>
          <span>Every event worth</span>
          <span style={{ color: "#ff5a2d", fontStyle: "italic" }}>showing up for.</span>
        </div>
        <div style={{ fontSize: 28, color: "#a39d92" }}>Conferences · Meetups · Hackathons · Workshops</div>
      </div>
    ),
    size,
  );
}
