import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, User as UserIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useShiftMutations } from "../hooks/useShiftMutations";
import { useFilteredUsers } from "../hooks/useUserFilters";
import { api } from "../contexts/AuthContext";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import { unwrapResults, cn, getUserOptionLabel } from "../lib/utils";
import type { User, Assignment } from "../types";

interface Props {
  assignment: Assignment | null;
  onClose: () => void;
  technologyId?: number;
  dateStr?: string;
  shiftAssignments?: Assignment[];
}

export function EditAssignmentDialog({ assignment, onClose, technologyId, dateStr, shiftAssignments }: Props) {
  const { editAssignment } = useShiftMutations();
  const { client_role_label, consultant_role_label } = useSiteSettings();
  const [type, setType] = useState<"WORK_HOURS" | "STANDBY">(assignment?.type ?? "WORK_HOURS");
  const [userId, setUserId] = useState<number>(assignment?.user.id ?? 0);
  const [role, setRole] = useState<"PRIMARY" | "BACKUP">(
    assignment?.standby_detail?.role ?? "PRIMARY"
  );
  const [phone, setPhone] = useState<string>(assignment?.standby_detail?.phone_number ?? "");

  const { data: users } = useQuery<User[]>({
    queryKey: dateStr ? ["users", "date", dateStr] : technologyId ? ["users", "technology", technologyId] : ["users"],
    queryFn: async () => {
      if (dateStr) {
        return unwrapResults(await api.get<User[]>(`/users/?date=${dateStr}`));
      }
      if (technologyId) {
        return unwrapResults(await api.get<User[]>(`/users/by_technology/?technology=${technologyId}`));
      }
      return [];
    },
    enabled: !!dateStr || !!technologyId,
  });

  const { users: sortedUsers } = useFilteredUsers({
    users,
    technologyId,
    isAdmin: true, // Edit dialog shows all users
    currentUserRole: undefined,
    shiftAssignments,
    assignmentType: type,
    currentAssignmentId: assignment?.id,
    onlyTechMembers: false,
  });

  useEffect(() => {
    if (!assignment) return;
    setType(assignment.type);
    setUserId(assignment.user.id);
    setRole(assignment.standby_detail?.role ?? "PRIMARY");
    setPhone(assignment.standby_detail?.phone_number ?? "");
  }, [assignment?.id]);

  if (!assignment) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h4 className="text-lg font-bold">Edit Assignment</h4>
            <p className="text-xs text-muted-foreground">Update assignment type</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            editAssignment.mutate(
              {
                id: assignment.id,
                type,
                user_id: userId,
                standby_detail_id: assignment.standby_detail?.id || null,
                standby_role: role,
                standby_phone: phone,
              },
              { onSuccess: onClose }
            );
          }}
          className="p-6 space-y-5"
        >
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Assigned User
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                className="flex h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                value={userId}
                onChange={(e) => setUserId(Number(e.target.value))}
              >
                {sortedUsers?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {getUserOptionLabel(u, {
                      technologyId,
                      consultantLabel: consultant_role_label,
                      clientLabel: client_role_label,
                    })}
                  </option>
                ))}
                {!sortedUsers?.find((u) => u.id === userId) && (
                  <option value={assignment.user.id}>
                    {getUserOptionLabel(assignment.user, {
                      technologyId,
                      consultantLabel: consultant_role_label,
                      clientLabel: client_role_label,
                    })}
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Assignment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("WORK_HOURS")}
                className={cn(
                  "flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all",
                  type === "WORK_HOURS"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border hover:bg-muted"
                )}
              >
                Work Hours
              </button>
              <button
                type="button"
                onClick={() => setType("STANDBY")}
                className={cn(
                  "flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all",
                  type === "STANDBY"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border hover:bg-muted"
                )}
              >
                Standby
              </button>
            </div>
          </div>
          {type === "STANDBY" && (
            <div className="grid gap-4 sm:grid-cols-2 animate-in slide-in-from-top-1">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Role
                </label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "PRIMARY" | "BACKUP")}
                >
                  <option value="PRIMARY">Primary</option>
                  <option value="BACKUP">Backup</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Phone
                </label>
                <input
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={phone ?? ""}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={editAssignment.isPending}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
          >
            {editAssignment.isPending ? "Updating..." : "Update Assignment"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
