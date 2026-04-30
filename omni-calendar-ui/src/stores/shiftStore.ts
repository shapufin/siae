import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addMonths, subMonths } from "date-fns";

interface ShiftState {
  selectedDate: Date | null;
  activeMonth: Date;
  activeTechnology: number | null;
  sidebarLayout: "stacked" | "tabbed";
  setSelectedDate: (date: Date | null) => void;
  setActiveMonth: (date: Date) => void;
  setActiveTechnology: (id: number | null) => void;
  setSidebarLayout: (layout: "stacked" | "tabbed") => void;
  nextMonth: () => void;
  prevMonth: () => void;
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set) => ({
      selectedDate: null,
      activeMonth: new Date(),
      activeTechnology: null,
      sidebarLayout: "stacked",
      setSelectedDate: (date) => set({ selectedDate: date }),
      setActiveMonth: (date) => set({ activeMonth: date }),
      setActiveTechnology: (id) => set({ activeTechnology: id }),
      setSidebarLayout: (layout) => set({ sidebarLayout: layout }),
      nextMonth: () => set((state) => ({ activeMonth: addMonths(state.activeMonth, 1) })),
      prevMonth: () => set((state) => ({ activeMonth: subMonths(state.activeMonth, 1) })),
    }),
    {
      name: "shift-store",
      partialize: (state) => ({
        sidebarLayout: state.sidebarLayout,
        activeTechnology: state.activeTechnology,
      }),
    }
  )
);
