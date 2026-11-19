import { pageMeta } from "@/lib/meta";

// An unlinked preview of the Journey section: reachable, not indexed
export const metadata = {
  ...pageMeta({
  title: "Journey",
  description: "How Searon Maharjan got here: study, projects and practice in web and interactive design, Kathmandu.",
  path: "/journey",
  }),
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
