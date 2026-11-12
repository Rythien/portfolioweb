import { create } from "zustand";

interface FractureState {
  breakVal: number;
  hoverBreak: boolean;
  cursorLabel: string;
}

export const useFractureStore = create<FractureState>(() => ({
  breakVal: 0,
  hoverBreak: false,
  cursorLabel: "",
}));
