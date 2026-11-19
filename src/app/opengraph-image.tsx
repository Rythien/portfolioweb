import { renderCard, CARD_SIZE } from "@/lib/ogCard";
import { SITE_DATA } from "@/content/site";

export const alt = `${SITE_DATA.brand.name}, ${SITE_DATA.brand.role}, ${SITE_DATA.brand.city}`;
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderCard({
    kicker: `${SITE_DATA.brand.city} · ${SITE_DATA.brand.coordinates}`,
    title: SITE_DATA.brand.name,
    subtitle: `${SITE_DATA.brand.role}. ${SITE_DATA.brand.tagline}`,
  });
}
