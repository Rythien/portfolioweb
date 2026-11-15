"use client";

import dynamic from "next/dynamic";
import { useThemeStore } from "@/store/useThemeStore";
import { useGameStore } from "@/store/useGameStore";

// The launcher (and, behind it, the game) is fetched only once the page
// is in DREAM, so WAKE visits pay nothing for it, not even a request
const DescentLauncher = dynamic(() => import("./DescentLauncher"), { ssr: false });

export default function DescentSlot() {
  const mode = useThemeStore((s) => s.mode);
  // Stay mounted while a game is open, whatever the mode does meanwhile
  const open = useGameStore((s) => s.open);
  return mode === "dream" || open ? <DescentLauncher /> : null;
}
