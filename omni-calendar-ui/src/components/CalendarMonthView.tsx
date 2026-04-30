import { useState, useEffect, useRef } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarCell } from "./CalendarCell";
import type { CalendarMonthViewProps } from "../types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarMonthView({
  month,
  selectedDate,
  shiftsByDay,
  vacationsByDay,
  onSelectDate,
  onChangeMonth,
  multiSelectedDates,
  onClearSelection,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const start = startOfWeek(monthStart, { weekStartsOn: 1 });
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;

  const [focusedDate, setFocusedDate] = useState<Date>(selectedDate || monthStart);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDate) setFocusedDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gridRef.current?.contains(document.activeElement)) return;
      const navigable = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Escape"];
      if (!navigable.includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Enter") {
        onSelectDate(focusedDate, e as unknown as React.KeyboardEvent);
        return;
      }
      if (e.key === "Escape") {
        onClearSelection?.();
        return;
      }
      let next = focusedDate;
      switch (e.key) {
        case "ArrowLeft": next = subDays(focusedDate, 1); break;
        case "ArrowRight": next = addDays(focusedDate, 1); break;
        case "ArrowUp": next = subDays(focusedDate, 7); break;
        case "ArrowDown": next = addDays(focusedDate, 7); break;
      }
      setFocusedDate(next);
      const dateStr = format(next, "yyyy-MM-dd");
      const el = gridRef.current?.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
      el?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedDate, onSelectDate, onClearSelection]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {format(month, "MMMM yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {days.filter((d) => isSameMonth(d, month)).length} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeMonth(subMonths(month, 1))}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onChangeMonth(new Date())}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground"
          >
            Today
          </button>
          <button
            onClick={() => onChangeMonth(addMonths(month, 1))}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={gridRef} role="grid" aria-label="Calendar" tabIndex={0} className="grid grid-cols-7 gap-1 outline-none">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
            role="columnheader"
          >
            {day}
          </div>
        ))}
        {days.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          return (
            <CalendarCell
              key={dateStr}
              date={date}
              dateStr={dateStr}
              currentMonth={month}
              shifts={shiftsByDay.get(dateStr) || []}
              vacations={vacationsByDay.get(dateStr) || []}
              isSelected={dateStr === selectedDateStr}
              isMultiSelected={multiSelectedDates?.has(dateStr) ?? false}
              onClick={(e) => onSelectDate(date, e)}
            />
          );
        })}
      </div>
    </div>
  );
}
