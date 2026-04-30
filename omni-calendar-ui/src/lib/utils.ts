import { format, parseISO } from "date-fns";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDisplayName(user: {
  first_name?: string | null;
  last_name?: string | null;
  username: string;
}): string {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ""} ${user.last_name || ""}`.trim();
  }
  return user.username;
}

export function getUserOptionLabel(
  user: User,
  opts: {
    technologyId?: number;
    consultantLabel?: string;
    clientLabel?: string;
  } = {}
): string {
  const { technologyId, consultantLabel, clientLabel } = opts;
  const userTech = user.technologies?.find((t) => t.technology.id === technologyId);
  const isDefault = userTech?.is_default;

  const roleLabel =
    user.role === "ENG"
      ? (consultantLabel ?? user.role)
      : user.role === "SIAE"
      ? (clientLabel ?? user.role)
      : user.role;

  let label = `${isDefault ? "★ " : ""}${getDisplayName(user)} (${roleLabel})`;

  if (user.vacation_status) {
    label += " — On Vacation";
  }

  if (userTech) {
    label += ` — ${userTech.technology.name}${isDefault ? " (Default)" : ""}`;
  } else if (user.technologies?.length) {
    label += ` — ${user.technologies.map((t) => t.technology.name).join(", ")}`;
  }

  return label;
}

export function getApiErrorMessage(
  err: unknown,
  fallback = "An error occurred"
): string {
  if (!err || typeof err !== "object") return fallback;
  if ("response" in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      if ("detail" in data) {
        const detail = (data as { detail?: string }).detail;
        if (detail) return detail;
      }
      const messages: string[] = [];
      for (const value of Object.values(data)) {
        if (Array.isArray(value)) {
          messages.push(
            ...value.filter((v): v is string => typeof v === "string")
          );
        } else if (typeof value === "string") {
          messages.push(value);
        }
      }
      if (messages.length > 0) return messages.join("; ");
    }
  }
  return fallback;
}

export function unwrapResults<T>(res: { data: { results?: T[] } | T[] }): T[] {
  const data = res.data as { results?: T[] };
  return data.results || (res.data as T[]);
}

export function filterByRole<U extends { role: string }>(
  items: U[] | undefined,
  isAdmin: boolean,
  currentRole: string | undefined
): U[] {
  if (!items) return [];
  if (isAdmin || !currentRole) return items;
  return items.filter((item) => item.role === currentRole);
}

export function getDomainBadgeClass(role: string) {
  switch (role) {
    case "SIAE":
      return "border-success/20 bg-success/5 text-success";
    case "ENG":
      return "border-info/20 bg-info/5 text-info";
    default:
      return "border-muted bg-muted/50 text-muted-foreground";
  }
}

export function getDomainColor(role: string) {
  switch (role) {
    case "SIAE":
      return "#22c55e";
    case "ENG":
      return "#3b82f6";
    default:
      return "#6b7280";
  }
}

export function getDomainLabel(role: string) {
  switch (role) {
    case "SIAE":
      return "SIAE";
    case "ENG":
      return "ENG";
    default:
      return "CR";
  }
}

export const VACATION_TYPE_OPTIONS = [
  { value: "PTO", label: "Paid Time Off" },
  { value: "SICK", label: "Sick Leave" },
  { value: "HOLIDAY", label: "Public Holiday" },
  { value: "OTHER", label: "Other" },
] as const;

export function dateRange(startStr: string, endStr: string): string[] {
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(format(cur, "yyyy-MM-dd"));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function makeMutationConfig(
  qc: QueryClient,
  showToast: (msg: string, type: "success" | "error" | "info") => void,
  config: {
    queryKey: string[];
    successMessage: string;
    errorMessage: string;
    onSuccessExtra?: () => void;
  }
) {
  return {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: config.queryKey });
      showToast(config.successMessage, "success");
      config.onSuccessExtra?.();
    },
    onError: (err: unknown) => {
      showToast(getApiErrorMessage(err, config.errorMessage), "error");
    },
  };
}
