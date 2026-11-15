import { create } from "zustand";

/**
 * Whether the DESCENT overlay is open. The scene (frameloop, marquee),
 * Lenis and the body scroll lock all follow this one flag, so closing the
 * game always restores the page, whichever path closed it.
 */
interface GameState {
  open: boolean;
  /** Last finished run, kept on the page after exit (metres). */
  lastScore: number | null;
  setOpen: (open: boolean) => void;
  setLastScore: (score: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  open: false,
  lastScore: null,
  setOpen: (open) => set({ open }),
  setLastScore: (lastScore) => set({ lastScore }),
}));
