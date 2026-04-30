import { useState, type ComponentType, lazy, Suspense } from "react";
import { Users, Wrench, CalendarDays, Shield, Bell, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import { cn } from "../lib/utils";

const UsersTab = lazy(() => import("./admin/UsersTab").then(m => ({ default: m.UsersTab })));
const TechnologiesTab = lazy(() => import("./admin/TechnologiesTab").then(m => ({ default: m.TechnologiesTab })));
const ShiftsTab = lazy(() => import("./admin/ShiftsTab").then(m => ({ default: m.ShiftsTab })));
const NotificationsTab = lazy(() => import("./admin/NotificationsTab").then(m => ({ default: m.NotificationsTab })));
const SettingsTab = lazy(() => import("./admin/SettingsTab").then(m => ({ default: m.SettingsTab })));

const ALL_TABS: { id: string; label: string; icon: ComponentType<{ className?: string }>; superuserOnly?: boolean }[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "technologies", label: "Technologies", icon: Wrench },
  { id: "shifts", label: "Shifts", icon: CalendarDays },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings, superuserOnly: true },
];

export function AdminDashboard() {
  const { isAdmin, isManager, user } = useAuth();
  const { brand_name } = useSiteSettings();
  const [tab, setTab] = useState("users");

  const tabs = ALL_TABS.filter((t) => !t.superuserOnly || user?.is_superuser);

  if (!isAdmin && !isManager) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{brand_name}</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">System Governance</p>
          </div>
        </div>
      </div>

      <div className="inline-flex w-full overflow-x-auto no-scrollbar gap-1 rounded-xl bg-secondary/30 p-1 border border-border/40 sm:w-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all",
                isActive
                  ? "bg-background text-primary shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
              aria-label={`${t.label} tab`}
            >
              <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground/60")} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          Loading...
        </div>
      }>
        {tab === "users" && <UsersTab />}
        {tab === "technologies" && <TechnologiesTab />}
        {tab === "shifts" && <ShiftsTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "settings" && <SettingsTab />}
      </Suspense>
    </div>
  );
}
