import { renderIcon } from "@/lib/ogCard";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself; the mark keeps clear of them
export default function AppleIcon() {
  return renderIcon(180, 34);
}
