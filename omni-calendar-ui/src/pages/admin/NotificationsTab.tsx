import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { Bell, Palmtree, AlertTriangle } from "lucide-react";
import { api, useAuth } from "../../contexts/AuthContext";
import { useSiteSettings } from "../../contexts/SiteSettingsContext";
import { getDisplayName, unwrapResults } from "../../lib/utils";
import { DEFAULT_PAGE_SIZE } from "../../lib/constants";
import type { Vacation } from "../../types";

export function NotificationsTab() {
  const { isAdmin } = useAuth();
  const { client_role_label, consultant_role_label } = useSiteSettings();
  const { data: vacations, isLoading } = useQuery<Vacation[]>({
    queryKey: ["vacations", "notifications"],
    queryFn: async () => unwrapResults(await api.get<Vacation[]>(`/vacations/?page_size=${DEFAULT_PAGE_SIZE}`)),
  });

  const { data: badgeData } = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: async () => {
      const res = await api.get("/notifications/badge/");
      return res.data as { count: number; vacations: Vacation[] };
    },
    refetchInterval: 1000 * 60 * 5,
  });

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { thisWeek, upcoming, past } = useMemo(() => {
    const sorted = [...(vacations || [])].sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
    const thisWeekList: Vacation[] = [];
    const upcomingList: Vacation[] = [];
    const pastList: Vacation[] = [];

    for (const v of sorted) {
      const start = parseISO(v.start_date);
      const end = parseISO(v.end_date);
      if (isWithinInterval(start, { start: weekStart, end: weekEnd }) || isWithinInterval(end, { start: weekStart, end: weekEnd }) || (start <= weekStart && end >= weekEnd)) {
        thisWeekList.push(v);
      } else if (end >= today) {
        upcomingList.push(v);
      } else {
        pastList.push(v);
      }
    }
    return { thisWeek: thisWeekList, upcoming: upcomingList, past: pastList };
  }, [vacations, weekStart, weekEnd, today]);

  const renderTable = (title: string, icon: React.ReactNode, items: Vacation[], accentClass: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${accentClass}`}>
            {icon}
          </div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {title} <span className="ml-1 text-xs font-medium">({items.length})</span>
          </h4>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">User</th>
                  {isAdmin && <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Domain</th>}
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Start</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">End</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {getDisplayName(v.user).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{getDisplayName(v.user)}</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                          v.user.role === "ENG"
                            ? "border-info/20 bg-info/5 text-info dark:border-info/80 dark:bg-info/30 dark:text-info-foreground"
                            : v.user.role === "SIAE"
                              ? "border-success/20 bg-success/5 text-success dark:border-success/80 dark:bg-success/30 dark:text-success-foreground"
                              : "border-muted bg-muted/50 text-muted-foreground"
                        }`}>
                          {v.user.role === "ENG" ? consultant_role_label : v.user.role === "SIAE" ? client_role_label : v.user.role}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{format(parseISO(v.start_date), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{format(parseISO(v.end_date), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                        {v.type || "PTO"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{v.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Notification History</h3>
          <p className="text-sm text-muted-foreground">
            Vacation alerts and history for your domain.
          </p>
        </div>
        {badgeData && badgeData.count > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {badgeData.count} active this week
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          Loading notifications...
        </div>
      ) : (
        <div className="space-y-8">
          {thisWeek.length === 0 && upcoming.length === 0 && past.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/40 bg-secondary/5 py-16 text-center">
              <Palmtree className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No vacation records found.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create vacations from the Vacations tab.</p>
            </div>
          )}

          {renderTable(
            "This Week",
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
            thisWeek,
            "bg-amber-500/10"
          )}

          {renderTable(
            "Upcoming",
            <Bell className="h-3.5 w-3.5 text-primary" />,
            upcoming,
            "bg-primary/10"
          )}

          {renderTable(
            "Past",
            <Palmtree className="h-3.5 w-3.5 text-muted-foreground" />,
            past,
            "bg-muted"
          )}
        </div>
      )}
    </div>
  );
}
