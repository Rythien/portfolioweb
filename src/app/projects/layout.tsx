import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Projects",
  description: "Selected work by Searon Maharjan: a food delivery platform, a studio website on a real-time 3D stage and an NDIS operations app, each with a case study.",
  path: "/projects",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
