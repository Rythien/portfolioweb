import { create } from "zustand";

export type Mode = "wake" | "dream";

interface TransitionOrigin {
  x: number;
  y: number;
}

interface ThemeState {
  mode: Mode;
  transitioning: boolean;
  clickOrigin: TransitionOrigin | null;
  setMode: (mode: Mode) => void;
  toggle: () => void;
  startTransition: (origin: TransitionOrigin) => void;
  endTransition: () => void;
}

function readPersistedMode(): Mode {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode");
    if (urlMode === "wake" || urlMode === "dream") return urlMode;

    const stored = localStorage.getItem("searon-mode");
    if (stored === "wake" || stored === "dream") return stored;
  } catch {
    // SSR or storage unavailable
  }
  return "wake";
}

function persistMode(mode: Mode) {
  try {
    localStorage.setItem("searon-mode", mode);
  } catch {
    // storage unavailable
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "wake",
  transitioning: false,
  clickOrigin: null,

  setMode: (mode) => {
    persistMode(mode);
    set({ mode });
  },

  toggle: () =>
    set((s) => {
      const next = s.mode === "wake" ? "dream" : "wake";
      persistMode(next);
      return { mode: next };
    }),

  startTransition: (origin) =>
    set({ transitioning: true, clickOrigin: origin }),

  endTransition: () =>
    set({ transitioning: false, clickOrigin: null }),
}));

export function initPersistedMode() {
  const mode = readPersistedMode();
  if (mode !== "wake") {
    useThemeStore.getState().setMode(mode);
  }
}
