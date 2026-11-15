import { create } from "zustand";

/**
 * Whether THE ARCHIVE (DREAM mode) has taken over the viewport. The awake
 * page follows this one flag: the scene's frameloop stops, Lenis stops,
 * scroll is locked. Clearing it always restores the page, whichever path
 * closed the Archive.
 */
interface ArchiveState {
  open: boolean;
  /** window.scrollY when the page was suspended; restored on WAKE. */
  savedScroll: number;
  setOpen: (open: boolean) => void;
  setSavedScroll: (y: number) => void;
}

export const useArchiveStore = create<ArchiveState>((set) => ({
  open: false,
  savedScroll: 0,
  setOpen: (open) => set({ open }),
  setSavedScroll: (savedScroll) => set({ savedScroll }),
}));
