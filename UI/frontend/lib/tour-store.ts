import { create } from "zustand";

interface TourStore {
  active: boolean;
  step: number;
  start: () => void;
  setStep: (step: number) => void;
  end: () => void;
}

export const useTourStore = create<TourStore>((set) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  setStep: (step) => set({ step }),
  end: () => set({ active: false, step: 0 }),
}));
