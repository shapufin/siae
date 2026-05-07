import { Phone, Trash2, Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useShiftMutations } from "../hooks/useShiftMutations";
import { canDeleteAssignment, canSeePhone } from "../lib/permissions";
import { cn, getDisplayName, getApiErrorMessage } from "../lib/utils";
import type { Shift, UserCardProps } from "../types";

export function UserCard({ assignmentId, user, type, standbyDetail, dateStr, hideTechnology, compact, onEdit }: UserCardProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isAdmin, isManager, user: currentUser } = useAuth();
  const { editAssignment } = useShiftMutations();
  const isCR = currentUser?.role === "CR";
  
  // Settling state: check if mutation is in flight for this assignment
  const isSettling = editAssignment.isPending && (editAssignment.variables as { id?: number } | undefined)?.id === assignmentId;

  const ctx = { user: currentUser, isAdmin, isManager, isReadOnly: false };
  const canDelete = canDeleteAssignment(ctx, user.id, user.role);
  const showPhone = canSeePhone(ctx);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/assignments/${assignmentId}/`);
    },
    onMutate: async () => {
      if (!dateStr) return;
      const queryKey = ["shifts", "date", dateStr];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Shift[]>(queryKey);
      if (previous) {
        const next = previous.map((shift) => ({
          ...shift,
          assignments: shift.assignments.filter((a) => a.id !== assignmentId),
        }));
        queryClient.setQueryData(queryKey, next);
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (!dateStr) return;
      const queryKey = ["shifts", "date", dateStr];
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      showToast(getApiErrorMessage(err, "Failed to remove assignment"), "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["shift"] });
    },
  });

  const displayName = getDisplayName(user);
  const userDefaultTech = user.technologies?.find((t) => t.is_default)?.technology;
  const isStandby = type === "STANDBY";
  const isPrimary = isStandby && standbyDetail?.role === "PRIMARY";
  const isBackup = isStandby && standbyDetail?.role === "BACKUP";
  const isWorkHours = type === "WORK_HOURS";

  // ── Compact horizontal row (sidebar / narrow columns) ────────────────────
  if (compact) {
    return (
      <div
        className={cn(
          "group flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-200 shadow-sm",
          isSettling && "animate-pulse border-primary/40 bg-primary/5 shadow-md scale-[0.99]",
          isPrimary
            ? "border-l-[5px] border-l-success bg-success/10 border-border/40 hover:bg-success/15"
            : isBackup
              ? "border-l-[5px] border-l-info bg-info/10 border-border/40 hover:bg-info/15"
              : user.vacation_status
                ? "border-destructive/50 bg-destructive/10 dark:border-destructive/30 dark:bg-destructive/5"
                : "border-border/40 bg-secondary/20 hover:bg-secondary/30"
        )}
      >
        {/* Compact Avatar */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-black shadow-inner border border-white/10",
              user.vacation_status
                ? "bg-destructive/20 text-destructive dark:text-destructive-foreground"
                : isPrimary
                  ? "bg-success/20 text-success-foreground"
                  : isBackup
                    ? "bg-info/20 text-info-foreground"
                    : "bg-primary/20 text-primary border-primary/30"
            )}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background shadow-sm",
              user.vacation_status ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            )}
            title={user.vacation_status ? "On vacation" : "Available"}
          />
        </div>

        {/* Compact Info & Badges Row - Stacked Layout with "Coefficient" labels */}
        <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
          {/* Coefficient Row (Role/Status) */}
          <div className="flex items-center gap-1.5 h-3 mb-1">
            {isStandby && standbyDetail && (
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-[0.1em] px-1 rounded-sm",
                  standbyDetail.role === "PRIMARY"
                    ? "bg-success/20 text-success"
                    : "bg-info/20 text-info"
                )}
              >
                {standbyDetail.role}
              </span>
            )}

            {isWorkHours && (
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-[0.1em] px-1 rounded-sm",
                  user.vacation_status
                    ? "bg-destructive/20 text-destructive"
                    : "bg-success/20 text-success"
                )}
              >
                {user.vacation_status ? "VACATION" : "AVAILABLE"}
              </span>
            )}
          </div>

          {/* Name Row */}
          <div className="flex items-center justify-between gap-2 overflow-hidden">
            <p className="font-bold text-[13px] tracking-tight text-foreground/90 truncate">
              {displayName}
            </p>
          </div>

          {/* Compact Phone for CR/Admin - Moved below name */}
          {showPhone && standbyDetail?.phone_number && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <a
                href={`tel:${standbyDetail.phone_number}`}
                className="group/phone flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary transition-all hover:bg-primary/20 hover:scale-[1.02] active:scale-95 border border-primary/20 shadow-sm"
                title={standbyDetail.phone_number}
              >
                <Phone className="h-3 w-3" />
                <span>{standbyDetail.phone_number}</span>
              </a>
            </div>
          )}
        </div>

        {/* Compact Actions */}
        {(onEdit && !isCR || canDelete) && (
          <div className="shrink-0 flex items-center gap-1 border-l border-border/40 pl-2 ml-1">
            {onEdit && !isCR && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="rounded-lg p-2 text-muted-foreground/30 transition-all hover:bg-primary/10 hover:text-primary md:opacity-0 md:group-hover:opacity-100 hover:scale-110 active:scale-90"
                title="Edit assignment"
                aria-label="Edit assignment"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Remove this assignment?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg p-2 text-muted-foreground/30 transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 hover:scale-110 active:scale-90"
                title="Remove assignment"
                aria-label="Remove assignment"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Full card layout (default) ──────────────────────────────────────────
  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-xl border p-3 transition-all duration-200",
        isSettling && "animate-pulse border-primary/40 bg-primary/5 shadow-md scale-[0.99]",
        isPrimary
          ? "border-l-[4px] border-l-success bg-success/5 dark:bg-success/10 border-border/60 hover:bg-success/10"
          : isBackup
            ? "border-l-[4px] border-l-info bg-info/5 dark:bg-info/10 border-border/60 hover:bg-info/10"
            : user.vacation_status
              ? "border-destructive/60 bg-destructive/5 dark:border-destructive/40 dark:bg-destructive/10"
              : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar with availability dot */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm",
              user.vacation_status
                ? "bg-destructive/20 text-destructive dark:text-destructive-foreground"
                : isPrimary
                  ? "bg-success/20 text-success-foreground"
                  : isBackup
                    ? "bg-info/20 text-info-foreground"
                    : "bg-primary/10 text-primary border border-primary/20"
            )}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background shadow-sm",
              user.vacation_status ? "bg-destructive" : "bg-success"
            )}
            title={user.vacation_status ? "On vacation" : "Available"}
          />
        </div>

        {/* Info Area */}
        <div className="min-w-0 flex-1">
          {/* Name + role chip row */}
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm tracking-tight text-foreground/90 break-words">
              {displayName}
            </p>
            <div className="flex items-center gap-1">
              {onEdit && !isCR && (
                <button
                  onClick={onEdit}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-primary/10 hover:text-primary md:opacity-0 md:group-hover:opacity-100"
                  title="Edit assignment"
                  aria-label="Edit assignment"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirm("Remove this assignment?")) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                  title="Remove assignment"
                  aria-label="Remove assignment"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Area - Conditional Visibility */}
      <div className="space-y-1.5 ml-[48px]">
        {/* Standby details shown on hover or for admins */}
        {isStandby && standbyDetail && (
          <div className="flex flex-wrap items-center gap-2 transition-all duration-200">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1 shadow-sm",
                standbyDetail.role === "PRIMARY"
                  ? "bg-success/10 text-success ring-success/30 dark:bg-success/20 dark:text-success-foreground dark:ring-success/40"
                  : "bg-info/10 text-info ring-info/30 dark:bg-info/20 dark:text-info-foreground dark:ring-info/40"
              )}
            >
              {standbyDetail.role}
            </span>
            {showPhone && standbyDetail?.phone_number && (
              <a
                href={`tel:${standbyDetail.phone_number}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary transition-all hover:bg-primary/20 hover:underline border border-primary/20 shadow-sm"
              >
                <Phone className="h-3 w-3" />
                {standbyDetail.phone_number}
              </a>
            )}
          </div>
        )}

        {/* Status markers */}
        <div className="flex flex-wrap items-center gap-2">
          {isWorkHours && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-sm",
                user.vacation_status
                  ? "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground"
                  : "bg-success/10 text-success dark:bg-success/20 dark:text-success-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", user.vacation_status ? "bg-destructive" : "bg-success")} />
              {user.vacation_status ? "VACATION" : "AVAILABLE"}
            </span>
          )}

          {userDefaultTech && !hideTechnology && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/90 bg-secondary/30 px-2 py-0.5 rounded-full">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: userDefaultTech.color_code }}
              />
              {userDefaultTech.name}
            </span>
          )}

          {isStandby && user.vacation_status && (
            <span className="text-[10px] font-bold text-destructive uppercase tracking-widest bg-destructive/10 px-2 py-0.5 rounded-full">
              On Vacation
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
