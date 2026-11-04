import { ImageResponse } from "next/og";

export const alt = "Searon Maharjan — Website & App Designer, Kathmandu";
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
          color: "#edebe6",
          fontFamily: "sans-serif",
          border: "1px solid rgba(237, 235, 230, 0.12)",
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
              color: "rgba(237, 235, 230, 0.6)",
              fontFamily: "monospace",
            }}
          >
            [ KATHMANDU · 27.7172°N 85.3240°E ]
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "16px",
              color: "#edebe6",
              fontFamily: "monospace",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#edebe6",
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
              color: "#edebe6",
            }}
          >
            <div style={{ display: "flex" }}>SEARON</div>
            <div style={{ display: "flex" }}>MAHARJAN</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "26px",
              color: "rgba(237, 235, 230, 0.7)",
              fontWeight: 400,
            }}
          >
            Website and App Designer · Frontend Developer
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingTop: "40px",
            borderTop: "1px solid rgba(237, 235, 230, 0.12)",
            fontFamily: "monospace",
            fontSize: "16px",
            color: "rgba(237, 235, 230, 0.5)",
          }}
        >
          <div style={{ display: "flex" }}>
            DESIGN · BUILD · SHIP
          </div>
          <div style={{ display: "flex" }}>© 2026 EDITION</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
