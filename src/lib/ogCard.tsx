import { ImageResponse } from "next/og";
import { SITE_DATA } from "@/content/site";

/**
 * Social cards and icons, in the site's WAKE palette: paper, ink, mono
 * labels, the diamond mark. One renderer, so every route's card is the
 * same object with its own words (and, for case studies, its own cover).
 */

export const CARD_SIZE = { width: 1200, height: 630 };
export const PAPER = "#E9E7E2";
export const INK = "#1a1a1e";
export const INK_MUTED = "#5f5f6c";
const RULE = "rgba(26, 26, 30, 0.14)";

/** The diamond mark (the Archive's "recovered" glyph), with one lit facet. */
export function Mark({ size, ink = INK }: { size: number; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M50 6 94 50 50 94 6 50Z" fill={ink} />
      <path d="M50 6 94 50 50 50Z" fill="#ffffff" fillOpacity={0.22} />
    </svg>
  );
}

interface CardProps {
  /** Mono line top left, e.g. "CASE STUDY // 01". */
  kicker: string;
  title: string;
  subtitle: string;
  /** A data: URI (JPEG/PNG) shown on the right half. */
  image?: string;
}

export function renderCard({ kicker, title, subtitle, image }: CardProps) {
  const textW = image ? 600 : 1040;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: PAPER,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: image ? 640 : "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 64px 56px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Mark size={22} />
            <div style={{ display: "flex", fontFamily: "monospace", fontSize: 20, letterSpacing: "0.12em", color: INK_MUTED }}>
              {kicker.toUpperCase()}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: textW }}>
            <div style={{ display: "flex", fontSize: title.length > 22 ? 64 : 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
              {title}
            </div>
            <div style={{ display: "flex", fontSize: 28, lineHeight: 1.35, color: INK_MUTED }}>{subtitle}</div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: `1px solid ${RULE}`,
              paddingTop: 22,
              fontFamily: "monospace",
              fontSize: 18,
              letterSpacing: "0.1em",
              color: INK_MUTED,
            }}
          >
            <div style={{ display: "flex" }}>{SITE_DATA.brand.name.toUpperCase()}</div>
            <div style={{ display: "flex" }}>{SITE_DATA.brand.city.toUpperCase()}</div>
          </div>
        </div>
        {image && (
          <div style={{ display: "flex", width: 560, height: "100%", borderLeft: `1px solid ${RULE}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
            <img src={image} width={560} height={630} style={{ objectFit: "cover", width: 560, height: 630 }} alt="" />
          </div>
        )}
      </div>
    ),
    CARD_SIZE,
  );
}

/** The mark alone on paper, for the favicon and touch icons. */
export function renderIcon(px: number, pad: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PAPER,
        }}
      >
        <Mark size={px - pad * 2} />
      </div>
    ),
    { width: px, height: px },
  );
}
