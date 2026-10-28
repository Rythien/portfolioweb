import { ImageResponse } from "next/og";

export const alt = "Searon Maharjan — Creative Developer & Frontend Architect";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#050505",
          color: "#f5f5f3",
          fontFamily: "sans-serif",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              letterSpacing: "0.2em",
              color: "#8e8e93",
              fontFamily: "monospace",
            }}
          >
            [ KATHMANDU · 27.71°N 85.32°E ]
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "16px",
              color: "#ff3b26",
              fontFamily: "monospace",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#ff3b26",
                display: "flex",
              }}
            />
            AVAILABLE FOR PROJECTS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "76px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#f5f5f3",
            }}
          >
            <div style={{ display: "flex" }}>SEARON</div>
            <div style={{ display: "flex", color: "#ff3b26" }}>MAHARJAN</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "26px",
              color: "#8e8e93",
              fontWeight: 400,
            }}
          >
            Creative Developer &amp; Frontend Architect
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingTop: "40px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            fontFamily: "monospace",
            fontSize: "16px",
            color: "#5c5c62",
          }}
        >
          <div style={{ display: "flex" }}>
            ARCHITECTURAL CODE · REALTIME WEBGL · MOTION SYSTEMS
          </div>
          <div style={{ display: "flex", color: "#ff3b26" }}>©2026 EDITION</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
