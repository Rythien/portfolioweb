import { create } from "zustand";

interface ScrollState {
  progress: number;
  velocity: number;
  direction: number;
}

export const useScrollStore = create<ScrollState>(() => ({
  progress: 0,
  velocity: 0,
  direction: 1,
}));

const _sectionProgress: Record<string, number> = {};

export function getSectionProgress(id: string): number {
  return _sectionProgress[id] ?? 0;
}

export function setSectionProgress(id: string, value: number) {
  _sectionProgress[id] = value;
}
