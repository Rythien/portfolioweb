import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Projects",
  description: "Selected work by Searon Maharjan: web platforms, 3D product animation and interface experiments, each with a case study.",
  path: "/projects",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
