import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Star, AlertTriangle } from "lucide-react";
import { api, useAuth } from "../contexts/AuthContext";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import { useToast } from "../contexts/ToastContext";
import { cn, getApiErrorMessage, getUserOptionLabel, unwrapResults } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import { useFilteredUsers } from "../hooks/useUserFilters";
import type { User, Shift, Assignment, AddAssignmentDialogProps } from "../types";

export function AddAssignmentDialog({ shiftId, date, onClose }: AddAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isAdmin, user, token } = useAuth();
  const { client_role_label, consultant_role_label } = useSiteSettings();
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<"WORK_HOURS" | "STANDBY">("WORK_HOURS");
  const [standbyRole, setStandbyRole] = useState<"PRIMARY" | "BACKUP">("BACKUP");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [onlyTechMembers, setOnlyTechMembers] = useState(false);

  const { data: users } = useQuery<User[]>({
    queryKey: queryKeys.users.date(date),
    queryFn: async () => {
      const res = await api.get(`/users/?date=${date}`);
      return unwrapResults(res);
    },
    enabled: !!token,
    retry: 3,
  });

  const { data: shift } = useQuery<Shift>({
    queryKey: queryKeys.shifts.single(shiftId),
    queryFn: async () => {
      const res = await api.get(`/shifts/${shiftId}/`);
      return res.data;
    },
    enabled: !!token,
    retry: 3,
  });

  const shiftTechnology = shift?.technology;

  const selectedUser = users?.find((u) => String(u.id) === userId);

  const standbyAssignments = shift?.assignments?.filter((a) => a.type === "STANDBY") || [];
  const hasPrimary = standbyAssignments.some((a) => a.standby_detail?.role === "PRIMARY");

  const handleUserChange = (id: string) => {
    setUserId(id);
    const u = users?.find((user) => String(user.id) === id);
    if (u?.phone_number) setPhoneNumber(u.phone_number);
  };

  const userDefaultTech = selectedUser?.technologies?.find((t) => t.is_default)?.technology;

  const autoStandbyRole = hasPrimary ? "BACKUP" : "PRIMARY";

  const handleTypeChange = (newType: "WORK_HOURS" | "STANDBY") => {
    setType(newType);
    if (newType === "STANDBY") {
      setStandbyRole(autoStandbyRole);
    }
  };

  const createAssignment = useMutation({
    mutationFn: async (data: { user_id: number; type: "WORK_HOURS" | "STANDBY"; standby_role?: "PRIMARY" | "BACKUP"; phone_number?: string }) => {
      // 1. Create the assignment
      const assignmentRes = await api.post("/assignments/", {
        shift: shiftId,
        user_id: data.user_id,
        type: data.type,
      });
      const assignment = assignmentRes.data;

      // 2. If it's a standby assignment, create the standby details
      if (data.type === "STANDBY") {
        await api.post("/standby-details/", {
          assignment: assignment.id,
          role: data.standby_role || "BACKUP",
          phone_number: data.phone_number || "",
        });
      }
      
      return assignment;
    },
    onMutate: async (data) => {
      const queryKey = queryKeys.shifts.admin(date);
      await queryClient.cancelQueries({ queryKey });
      const previousShifts = queryClient.getQueryData<Shift[]>(queryKey);
      const selectedUser = users?.find((u) => u.id === data.user_id);
      if (previousShifts && selectedUser) {
        const optimisticAssignment: Assignment = {
          id: Math.floor(Math.random() * -1000000), // Better than -Date.now() for react keys
          shift: shiftId,
          user: selectedUser,
          type: data.type,
          standby_detail:
            data.type === "STANDBY"
              ? {
                  role: data.standby_role || "BACKUP",
                  phone_number: data.phone_number || "",
                }
              : null,
        };
        const nextShifts = previousShifts.map((shift) => {
          if (shift.id !== shiftId) return shift;
          return {
            ...shift,
            assignments: [...shift.assignments, optimisticAssignment],
          };
        });
        queryClient.setQueryData(queryKey, nextShifts);
      }
      return { previousShifts };
    },
    onSuccess: () => {
      onClose();
    },
    onError: (err, _variables, context) => {
      const queryKey = queryKeys.shifts.admin(date);
      if (context?.previousShifts) {
        queryClient.setQueryData(queryKey, context.previousShifts);
      }
      showToast(getApiErrorMessage(err, "Failed to create assignment"), "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    createAssignment.mutate({
      user_id: Number(userId),
      type,
      standby_role: type === "STANDBY" ? standbyRole : undefined,
      phone_number: type === "STANDBY" ? phoneNumber : undefined,
    });
  };

  const { users: filteredUsers } = useFilteredUsers({
    users,
    technologyId: shiftTechnology?.id,
    isAdmin,
    currentUserRole: user?.role,
    shiftAssignments: shift?.assignments,
    assignmentType: type,
    onlyTechMembers,
  });

  const selectedUserTech = selectedUser?.technologies?.find(
    (t) => t.technology.id === shiftTechnology?.id
  );

  const isPrimaryCollision = type === "STANDBY" && standbyRole === "PRIMARY" && hasPrimary;

  const modalContent = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add Assignment</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="assign-user" className="text-sm font-medium">User</label>
              {shiftTechnology && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: shiftTechnology.color_code }}
                  />
                  {shiftTechnology.name}
                </span>
              )}
            </div>

            <select
              id="assign-user"
              value={userId}
              onChange={(e) => {
                e.stopPropagation();
                handleUserChange(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select a user...</option>
              {filteredUsers?.map((u) => (
                <option key={u.id} value={u.id}>
                  {getUserOptionLabel(u, {
                    technologyId: shiftTechnology?.id,
                    consultantLabel: consultant_role_label,
                    clientLabel: client_role_label,
                  })}
                </option>
              ))}
            </select>

            {shiftTechnology && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={onlyTechMembers}
                  onChange={(e) => {
                    e.stopPropagation();
                    setOnlyTechMembers(e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 rounded border-primary"
                />
                Show only team members with this technology
              </label>
            )}

            {selectedUser && (
              <div className="space-y-2 rounded-md bg-secondary/30 p-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      selectedUser.vacation_status ? "bg-destructive" : "bg-success"
                    )}
                  />
                  {selectedUser.vacation_status ? "On vacation" : "Available"}
                  {userDefaultTech && (
                    <>
                      <span className="mx-1">·</span>
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: userDefaultTech.color_code }}
                      />
                      <span>{userDefaultTech.name}</span>
                    </>
                  )}
                </div>

                {shiftTechnology && (
                  <div className="flex items-center gap-1.5">
                    {selectedUserTech ? (
                      <>
                        {selectedUserTech.is_default ? (
                          <>
                            <Star className="h-3.5 w-3.5 text-success fill-success" />
                            <span className="text-success font-medium">
                              Default technology for this user
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: shiftTechnology.color_code }}
                            />
                            <span className="text-muted-foreground">
                              Has {shiftTechnology.name} (not default)
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-info" />
                        <span className="text-info">
                          User not assigned to this technology in profile
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTypeChange("WORK_HOURS");
                }}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm",
                  type === "WORK_HOURS"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                )}
              >
                Work Hours
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTypeChange("STANDBY");
                }}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm",
                  type === "STANDBY"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                )}
              >
                Standby
                {standbyAssignments.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                    {standbyAssignments.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {type === "STANDBY" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Standby Role</label>
                  {standbyAssignments.length > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {standbyAssignments.length} existing — {hasPrimary ? "PRIMARY filled" : "PRIMARY available"}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStandbyRole("PRIMARY");
                    }}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm",
                      standbyRole === "PRIMARY"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary"
                    )}
                  >
                    Primary
                    {hasPrimary && standbyRole !== "PRIMARY" && (
                      <span className="ml-1 text-[10px] opacity-70">(taken)</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStandbyRole("BACKUP");
                    }}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm",
                      standbyRole === "BACKUP"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary"
                    )}
                  >
                    Backup
                    <span className="ml-1 text-[10px] opacity-70">({standbyAssignments.length - (hasPrimary ? 1 : 0)})</span>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Auto-selected: {standbyRole === "PRIMARY" ? "PRIMARY" : "BACKUP"} — shift this assignment to another role if needed.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="standby-phone" className="text-sm font-medium">Phone Number</label>
                <input
                  id="standby-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    e.stopPropagation();
                    setPhoneNumber(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="+39 123 456 7890"
                />
              </div>
            </>
          )}

          {createAssignment.isError && (
            <p className="text-sm text-destructive">
              Failed to create assignment. Please try again.
            </p>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createAssignment.isPending || !userId || isPrimaryCollision}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {createAssignment.isPending
                ? "Adding..."
                : isPrimaryCollision
                ? "Primary Role Taken"
                : "Add Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
