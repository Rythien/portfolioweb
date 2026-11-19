import { renderCard, CARD_SIZE } from "@/lib/ogCard";

export const alt = "Selected work: Web platforms, 3D product animation and interface experiments.";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderCard({ kicker: "Index", title: "Selected work", subtitle: "Web platforms, 3D product animation and interface experiments." });
}
