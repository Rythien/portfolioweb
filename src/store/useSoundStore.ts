import { create } from "zustand";

interface SoundState {
  enabled: boolean;
  toggle: () => void;
}

export const useSoundStore = create<SoundState>((set) => ({
  enabled: false,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
}));
