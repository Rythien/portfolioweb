import { create } from "zustand";

export type Mode = "wake" | "dream";

interface ThemeState {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "wake",
  setMode: (mode) => set({ mode }),
  toggle: () =>
    set((s) => ({ mode: s.mode === "wake" ? "dream" : "wake" })),
}));
