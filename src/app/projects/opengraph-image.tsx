import { renderCard, CARD_SIZE } from "@/lib/ogCard";

export const alt = "Selected work: A food delivery platform, a studio website on a real-time 3D stage and an NDIS operations app.";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderCard({ kicker: "Index", title: "Selected work", subtitle: "A food delivery platform, a studio website on a real-time 3D stage and an NDIS operations app." });
}
