import { renderCard, CARD_SIZE } from "@/lib/ogCard";

export const alt = "Searon Maharjan: Web & Interactive Designer. Frontend developer, Kathmandu.";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderCard({ kicker: "Curriculum vitae", title: "Searon Maharjan", subtitle: "Web & Interactive Designer. Frontend developer, Kathmandu." });
}
