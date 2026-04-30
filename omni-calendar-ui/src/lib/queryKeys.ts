// Query Key Factory — centralizes all TanStack Query keys to prevent typos
// and make invalidation patterns discoverable.

export const queryKeys = {
  shifts: {
    all: ["shifts"] as const,
    month: (start: string, end: string, tech?: number | null) =>
      ["shifts", "month", start, end, tech ?? null] as const,
    admin: (date: string | null) => ["shifts", "admin", date] as const,
    detail: (id: number) => ["shifts", id] as const,
    single: (id: number) => ["shift", id] as const,
  },
  vacations: {
    all: ["vacations"] as const,
    month: (start: string, end: string) =>
      ["vacations", "month", start, end] as const,
    notifications: ["vacations", "notifications"] as const,
  },
  users: {
    all: ["users"] as const,
    date: (date: string) => ["users", "date", date] as const,
    technology: (id: number) => ["users", "technology", id] as const,
    page: (page: number) => ["users", "page", page] as const,
  },
  technologies: {
    all: ["technologies"] as const,
    search: (q: string) => ["technologies", q] as const,
    defaultCrew: (id: number) => ["default-crew", id] as const,
  },
  notifications: {
    badge: ["notifications", "badge"] as const,
  },
  settings: {
    all: ["site-settings"] as const,
    public: ["site-settings-public"] as const,
  },
} as const;
