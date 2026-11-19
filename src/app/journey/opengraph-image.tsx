import { renderCard, CARD_SIZE } from "@/lib/ogCard";

export const alt = "The path so far: Study, projects and practice in web and interactive design.";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderCard({ kicker: "Journey", title: "The path so far", subtitle: "Study, projects and practice in web and interactive design." });
}
