import { Routes, Route, Link, Navigate } from "react-router-dom";
import { ThemeToggle } from "./components/ThemeToggle";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { NotificationBadge } from "./components/NotificationBadge";
import { CalendarDashboard } from "./pages/CalendarDashboard";
import { VacationHub } from "./pages/VacationHub";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useSiteSettings } from "./contexts/SiteSettingsContext";
import { CalendarDays, LogOut, User, Users } from "lucide-react";

function Nav() {
  const { user, logout, isReadOnly, isAdmin, isManager } = useAuth();

  if (!user) return null;

  return (
    <nav className="flex flex-wrap items-center gap-2 pb-1 md:gap-4 md:pb-0">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground md:px-3 md:text-sm"
      >
        <CalendarDays className="h-4 w-4" />
        Calendar
      </Link>
      {!isReadOnly && (
        <Link
          to="/vacations"
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground md:px-3 md:text-sm"
        >
          <CalendarDays className="h-4 w-4" />
          Vacations
        </Link>
      )}
      {(isAdmin || isManager) && (
        <Link
          to="/admin"
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground md:px-3 md:text-sm"
        >
          <Users className="h-4 w-4" />
          Admin
        </Link>
      )}
      <div className="shrink-0">
        <NotificationBadge />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-l border-border pl-2 md:pl-4">
        <User className="h-4 w-4 text-muted-foreground hidden sm:block" />
        <span className="text-xs text-muted-foreground max-w-[80px] truncate sm:max-w-none md:text-sm">{user.username}</span>
        <button
          onClick={logout}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<CalendarDashboard />} />
      <Route path="/vacations" element={<VacationHub />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppHeader() {
  const { brand_name } = useSiteSettings();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-md md:py-3">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
        <Link to="/" className="text-lg font-bold tracking-tight sm:text-xl">
          {brand_name}
        </Link>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
          <Nav />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function App() {
  const { announcement_enabled, announcement_text, announcement_color } = useSiteSettings();

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground">
        {announcement_enabled && announcement_text && (
          <AnnouncementBanner text={announcement_text} color={announcement_color} />
        )}
        <AppHeader />
        <main className="mx-auto max-w-7xl p-4">
          <AppRoutes />
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;
