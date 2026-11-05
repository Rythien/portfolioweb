"use client";

import { useEffect } from "react";
import { useThemeStore, initPersistedMode } from "@/store/useThemeStore";

export default function ThemeSync() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    initPersistedMode();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  return null;
}
