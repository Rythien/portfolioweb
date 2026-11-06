import { create } from "zustand";

interface FractureState {
  burst: boolean;
  setBurst: (v: boolean) => void;
}

export const useFractureStore = create<FractureState>((set) => ({
  burst: false,
  setBurst: (v) => set({ burst: v }),
}));
