import { create } from "zustand";

interface FractureState {
  breakVal: number;
}

export const useFractureStore = create<FractureState>(() => ({
  breakVal: 0,
}));
