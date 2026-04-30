import { useState, useRef, useEffect } from "react";
import { Shield, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from "date-fns";
import { filterByRole, getDisplayName, VACATION_TYPE_OPTIONS } from "../lib/utils";
import type { User, Vacation } from "../types";

export interface VacationFormState {
  user_id: string;
  start_date: string;
  end_date: string;
  type: Vacation["type"];
  notes: string;
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => value ? parseISO(value) : new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const handleSelectDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setIsOpen(false);
  };

  return (
    <div className="space-y-2" ref={ref}>
      <label className="text-sm font-medium">{label} *</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-primary/50 transition-colors"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className={value ? "" : "text-muted-foreground"}>
            {value ? format(parseISO(value), "dd MMMM yyyy") : "Select date..."}
          </span>
        </button>
        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-full max-w-xs sm:w-72 rounded-lg border border-border bg-popover p-4 shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 hover:bg-secondary rounded-md"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 hover:bg-secondary rounded-md"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="text-muted-foreground font-medium py-1">
                  {day}
                </div>
              ))}
              {days.map((date) => {
                const isSelected = value && isSameDay(parseISO(value), date);
                const isCurrentMonth = isSameMonth(date, currentMonth);
                const isDayToday = isToday(date);
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => handleSelectDate(date)}
                    disabled={!isCurrentMonth}
                    className={`
                      py-1 rounded-md transition-colors
                      ${isSelected ? "bg-primary text-primary-foreground font-semibold" : ""}
                      ${isDayToday && !isSelected ? "border border-primary" : ""}
                      ${!isCurrentMonth ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-secondary"}
                    `}
                  >
                    {format(date, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface VacationFormFieldsProps {
  value: VacationFormState;
  onChange: (value: VacationFormState) => void;
  users?: User[];
  isAdmin: boolean;
  currentRole?: string;
  showUserSelect?: boolean;
  currentUserName?: string;
}

export function VacationFormFields({
  value,
  onChange,
  users,
  isAdmin,
  currentRole,
  showUserSelect,
  currentUserName,
}: VacationFormFieldsProps) {
  return (
    <div className="space-y-4">
      {showUserSelect && users && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            <Shield className="h-3 w-3" />
            User *
          </label>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={value.user_id}
            onChange={(e) => onChange({ ...value, user_id: e.target.value })}
          >
            <option value="">{currentUserName ? `Myself (${currentUserName})` : "Select user..."}</option>
            {filterByRole(users, isAdmin, currentRole).map((u) => (
              <option key={u.id} value={u.id}>
                {getDisplayName(u)} ({u.role})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="Start Date"
          value={value.start_date}
          onChange={(val) => onChange({ ...value, start_date: val })}
        />
        <DatePicker
          label="End Date"
          value={value.end_date}
          onChange={(val) => onChange({ ...value, end_date: val })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={value.type || "PTO"}
            onChange={(e) => onChange({ ...value, type: e.target.value as Vacation["type"] })}
          >
            {VACATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={value.notes || ""}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            rows={1}
          />
        </div>
      </div>
    </div>
  );
}
