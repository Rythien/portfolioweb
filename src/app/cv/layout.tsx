import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "CV",
  description: "Curriculum vitae of Searon Maharjan, web and interactive designer and frontend developer in Kathmandu, Nepal.",
  path: "/cv",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
