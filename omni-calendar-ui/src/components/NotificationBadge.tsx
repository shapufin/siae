import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Palmtree, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { api, useAuth } from "../contexts/AuthContext";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import { getDisplayName } from "../lib/utils";
import type { Vacation } from "../types";

interface BadgeData {
  count: number;
  vacations: Array<Pick<Vacation, "id" | "user" | "start_date" | "end_date" | "type">>;
}

const DISMISSED_KEY = "dismissed_vacation_ids";

function getDismissedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function setDismissedIds(ids: Set<number>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
}

export function NotificationBadge() {
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIdsState] = useState<Set<number>>(getDismissedIds);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { user, isAdmin, isManager } = useAuth();
  const { client_role_label, consultant_role_label } = useSiteSettings();

  const { data } = useQuery<BadgeData>({
    queryKey: ["notifications", "badge"],
    queryFn: async () => {
      const res = await api.get("/notifications/badge/");
      return res.data;
    },
    refetchInterval: 1000 * 30,
  });

  const visibleVacations = useMemo(() => {
    if (!data?.vacations) return [];
    return data.vacations.filter((v) => !dismissedIds.has(v.id));
  }, [data?.vacations, dismissedIds]);

  const count = visibleVacations.length;

  const handleClear = () => {
    const newDismissed = new Set(dismissedIds);
    data?.vacations.forEach((v) => newDismissed.add(v.id));
    setDismissedIdsState(newDismissed);
    setDismissedIds(newDismissed);
    qc.invalidateQueries({ queryKey: ["notifications", "badge"] });
  };

  // Backend returns opposite-role vacations for managers (SIAE sees ENG vacations, ENG sees SIAE)
  const oppositeRoleLabel = user?.role === "ENG" ? client_role_label : user?.role === "SIAE" ? consultant_role_label : null;
  const label = isAdmin
    ? "All Vacations"
    : isManager && oppositeRoleLabel
      ? `${oppositeRoleLabel} Vacations`
      : "Your Vacations";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={`${count} notifications`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Palmtree className="h-3.5 w-3.5" />
              {label}
            </p>
            {count > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-destructive hover:bg-destructive/10 transition-colors"
              >
                <XCircle className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>
          <div className="space-y-1">
            {visibleVacations.length > 0 ? (
              visibleVacations.map((vacation) => (
                <div
                  key={vacation.id}
                  className="rounded-md px-2 py-1.5 text-sm hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate">
                      {getDisplayName(vacation.user)}
                    </p>
                    {vacation.type && (
                      <span className="ml-2 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                        {vacation.type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(vacation.start_date), "dd MMMM yyyy")} - {format(parseISO(vacation.end_date), "dd MMMM yyyy")}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-md px-2 py-3 text-center text-xs text-muted-foreground">
                No vacations
              </div>
            )}
          </div>
          {(data?.count ?? 0) > visibleVacations.length && (
            <p className="mt-2 border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
              +{(data!.count - visibleVacations.length)} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
