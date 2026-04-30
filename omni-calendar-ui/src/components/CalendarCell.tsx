import { format, isSameMonth, isToday } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { cn, getDomainColor } from "../lib/utils";
import { MAX_VISIBLE_SHIFT_STRIPS } from "../lib/constants";
import type { CalendarCellProps } from "../types";

export function CalendarCell({
  date,
  dateStr,
  currentMonth,
  shifts,
  vacations,
  isSelected,
  isMultiSelected,
  onClick,
}: CalendarCellProps) {
  const inMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);

  const domainOrder = { SIAE: 0, ENG: 1, CR: 2 };
  const sortedShifts = [...shifts].sort((a, b) => (domainOrder[a.technology.role as keyof typeof domainOrder] ?? 2) - (domainOrder[b.technology.role as keyof typeof domainOrder] ?? 2));
  const shiftStrips = sortedShifts.slice(0, MAX_VISIBLE_SHIFT_STRIPS);
  const overflow = sortedShifts.length > MAX_VISIBLE_SHIFT_STRIPS;
  const totalAssignments = sortedShifts.reduce((acc, s) => acc + s.assignment_count, 0);
  
  // Task 8: Check if any shift on this day has at least one standby assignment
  const hasStandbyReady = shifts.some(s => s.has_standby);

  return (
    <button
      onClick={(e) => onClick(e)}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-violet-500/20 dark:border-violet-400/30 p-2 text-left transition-all duration-300",
        "min-h-[90px] md:min-h-[120px] w-full shadow-sm",
        inMonth
          ? "bg-background hover:z-10 hover:border-primary/30 hover:bg-secondary/20 hover:shadow-md hover:-translate-y-0.5"
          : "border-border/20 bg-muted/20 text-muted-foreground/40",
        today && "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background z-10",
        isMultiSelected && "bg-primary/[0.06] ring-1 ring-primary/40 z-10",
        vacations.length > 0 && "border-l-[4px] border-l-destructive/60"
      )}
      data-date={dateStr}
      aria-label={format(date, "EEEE, MMMM d, yyyy")}
      aria-selected={isSelected || !!isMultiSelected}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              "text-sm font-bold tracking-tight",
              today && "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[13px] font-black text-primary-foreground shadow-sm",
              !inMonth && "text-muted-foreground/40 font-medium"
            )}
          >
            {format(date, "d")}
          </span>
          
          {/* Task 8: Standby Ready Indicator */}
          {hasStandbyReady && (
            <div 
              className="flex items-center gap-0.5 rounded-md bg-success/10 px-1 py-0.5 text-[8px] font-black uppercase tracking-tighter text-success dark:bg-success/20 dark:text-success-foreground"
              title="Standby Ready"
            >
              <ShieldCheck className="h-2.5 w-2.5" />
              Ready
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {totalAssignments > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary shadow-sm">
              {totalAssignments}
            </span>
          )}
          {vacations.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-black text-destructive shadow-sm">
              {vacations.length}
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          {shiftStrips.map((shift) => (
            <div
              key={shift.id}
              className="h-[4px] flex-1 rounded-full shadow-sm"
              style={{
                backgroundColor: getDomainColor(shift.technology.role),
                opacity: 0.75,
              }}
              title={`[${shift.technology.role}] ${shift.technology.name} (${shift.assignment_count} assignments)`}
            />
          ))}
        </div>
        {overflow && (
          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
            +{shifts.length - MAX_VISIBLE_SHIFT_STRIPS} others
          </span>
        )}
      </div>
    </button>
  );
}
