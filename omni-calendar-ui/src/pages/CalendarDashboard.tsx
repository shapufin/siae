import { useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { CalendarMonthView } from "../components/CalendarMonthView";
import { DayDrawer } from "../components/DayDrawer";
import { unwrapResults, dateRange } from "../lib/utils";
import { api } from "../contexts/AuthContext";
import { useShiftStore } from "../stores/shiftStore";
import { DEFAULT_PAGE_SIZE } from "../lib/constants";
import { queryKeys } from "../lib/queryKeys";
import type { ShiftSummary, Vacation } from "../types";

export function CalendarDashboard() {
  const { 
    selectedDate, 
    setSelectedDate, 
    activeMonth, 
    setActiveMonth,
    activeTechnology
  } = useShiftStore();

  const monthStart = startOfMonth(activeMonth);
  const monthEnd = endOfMonth(activeMonth);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  const { data: monthShifts } = useQuery<ShiftSummary[]>({
    queryKey: queryKeys.shifts.month(monthStartStr, monthEndStr, activeTechnology),
    queryFn: async () => {
      let url = `/shifts/?date__gte=${monthStartStr}&date__lte=${monthEndStr}&page_size=${DEFAULT_PAGE_SIZE}&all=true`;
      if (activeTechnology) {
        url += `&technology=${activeTechnology}`;
      }
      return unwrapResults(await api.get<ShiftSummary[]>(url));
    },
  });

  const { data: monthVacations } = useQuery<Vacation[]>({
    queryKey: queryKeys.vacations.month(monthStartStr, monthEndStr),
    queryFn: async () => unwrapResults(await api.get<Vacation[]>(`/vacations/?start_date__lte=${monthEndStr}&end_date__gte=${monthStartStr}&page_size=${DEFAULT_PAGE_SIZE}&all=true`)),
  });

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, ShiftSummary[]>();
    monthShifts?.forEach((shift) => {
      const dayStr = shift.date;
      if (!map.has(dayStr)) map.set(dayStr, []);
      map.get(dayStr)!.push(shift);
    });
    return map;
  }, [monthShifts]);

  const vacationsByDay = useMemo(() => {
    const map = new Map<string, Vacation[]>();
    monthVacations?.forEach((vacation) => {
      for (const dayStr of dateRange(vacation.start_date, vacation.end_date)) {
        if (!map.has(dayStr)) map.set(dayStr, []);
        map.get(dayStr)!.push(vacation);
      }
    });
    return map;
  }, [monthVacations]);

  return (
    <div className="relative space-y-4">
      <CalendarMonthView
        month={activeMonth}
        selectedDate={selectedDate}
        shiftsByDay={shiftsByDay}
        vacationsByDay={vacationsByDay}
        onSelectDate={(date, _e) => setSelectedDate(date)}
        onChangeMonth={setActiveMonth}
      />

      {selectedDate && (
        <DayDrawer
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
