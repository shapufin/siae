import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { X, CalendarRange, Users, Info, Check } from "lucide-react";
import { api, useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { cn, getApiErrorMessage, getDisplayName, unwrapResults, filterByRole, dateRange } from "../../lib/utils";
import { DEFAULT_PAGE_SIZE, MAX_NOTES_LENGTH } from "../../lib/constants";
import { queryKeys } from "../../lib/queryKeys";
import { CalendarMonthView } from "../../components/CalendarMonthView";
import { AdminDayPanel } from "../../components/AdminDayPanel";
import { EditShiftDialog } from "../../components/EditShiftDialog";
import { EditAssignmentDialog } from "../../components/EditAssignmentDialog";
import { useShiftMutations } from "../../hooks/useShiftMutations";
import type { Shift, Technology, User, Assignment, ShiftSummary, Vacation } from "../../types";

export function ShiftsTab() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isAdmin, isManager, user: currentUser } = useAuth();
  const canManage = isAdmin || isManager;

  const [activeMonth, setActiveMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<"stacked" | "tabbed">(() => {
    const saved = localStorage.getItem("adminSidebarLayout");
    return (saved === "stacked" || saved === "tabbed") ? saved : "stacked";
  });

  useEffect(() => {
    localStorage.setItem("adminSidebarLayout", layout);
  }, [layout]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    technology_id: "",
    notes: "",
    assign_team: false,
    assignment_type: "WORK_HOURS" as "WORK_HOURS" | "STANDBY",
  });
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [addingAssignmentTo, setAddingAssignmentTo] = useState<Shift | null>(null);
  const [newAssignment, setNewAssignment] = useState({ user_id: "", type: "WORK_HOURS" as "WORK_HOURS" | "STANDBY", standby_role: "PRIMARY" as "PRIMARY" | "BACKUP", standby_phone: "" });
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editingAssignmentDate, setEditingAssignmentDate] = useState<string | null>(null);

  const monthStart = startOfMonth(activeMonth);
  const monthEnd = endOfMonth(activeMonth);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  const { data: monthShifts } = useQuery<ShiftSummary[]>({
    queryKey: queryKeys.shifts.month(monthStartStr, monthEndStr),
    queryFn: async () => unwrapResults(await api.get<ShiftSummary[]>(`/shifts/?date__gte=${monthStartStr}&date__lte=${monthEndStr}&page_size=${DEFAULT_PAGE_SIZE}`)),
  });

  const { data: monthVacations } = useQuery<Vacation[]>({
    queryKey: queryKeys.vacations.month(monthStartStr, monthEndStr),
    queryFn: async () => unwrapResults(await api.get<Vacation[]>(`/vacations/?start_date__lte=${monthEndStr}&end_date__gte=${monthStartStr}&page_size=${DEFAULT_PAGE_SIZE}`)),
  });

  const selectedDateStr = selectedDates.size === 1 ? Array.from(selectedDates)[0] : null;

  const { data: singleDayShifts, isLoading: singleDayLoading } = useQuery<Shift[]>({
    queryKey: queryKeys.shifts.admin(selectedDateStr),
    queryFn: async () => {
      if (!selectedDateStr) return [];
      return unwrapResults(await api.get<Shift[]>(`/shifts/?date=${selectedDateStr}`));
    },
    enabled: !!selectedDateStr,
  });

  const { data: techs } = useQuery<Technology[]>({
    queryKey: queryKeys.technologies.all,
    queryFn: async () => unwrapResults(await api.get<Technology[]>("/technologies/?all=true")),
  });

  const { data: users } = useQuery<User[]>({
    queryKey: queryKeys.users.all,
    queryFn: async () => unwrapResults(await api.get<User[]>(`/users/?page_size=${DEFAULT_PAGE_SIZE}`)),
  });

  const isSuperuser = currentUser?.is_superuser;
  const domainMatch = (s: { technology: { role: string } }) =>
    isAdmin || isSuperuser ? true : s.technology.role === currentUser?.role;

  const visibleMonthShifts = useMemo(() => {
    if (!monthShifts) return [];
    return monthShifts.filter(domainMatch);
  }, [monthShifts, isAdmin, isSuperuser, currentUser?.role]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, ShiftSummary[]>();
    visibleMonthShifts.forEach((shift) => {
      const dayStr = shift.date;
      if (!map.has(dayStr)) map.set(dayStr, []);
      map.get(dayStr)!.push(shift);
    });
    return map;
  }, [visibleMonthShifts]);

  const vacationsByDay = useMemo(() => {
    const map = new Map<string, Vacation[]>();
    monthVacations?.forEach((vacation) => {
      for (const dayStr of dateRange(vacation.start_date, vacation.end_date)) {
        if (!map.has(dayStr)) map.set(dayStr, []);
        map.get(dayStr)!.push(vacation);
      }
    });
    return map;
  }, [monthVacations]);

  const createShifts = useMutation({
    mutationFn: async (d: typeof form) => {
      const created: Shift[] = [];
      const dates = dateRange(d.start_date, d.end_date);

      for (const dateStr of dates) {
        const res = await api.post("/shifts/", {
          date: dateStr,
          technology_id: Number(d.technology_id),
          notes: d.notes,
          auto_populate: d.assign_team && d.assignment_type === "WORK_HOURS",
        });
        const shift = res.data as Shift;
        created.push(shift);

        // Auto-populate STANDBY team via explicit frontend loop (requires standby details)
        if (d.assign_team && d.assignment_type === "STANDBY") {
          const team = users?.filter((u) => u.technologies?.some((t) => String(t.technology.id) === d.technology_id)) || [];
          let standbyIdx = 0;
          for (const u of team) {
            const assignRes = await api.post("/assignments/", {
              shift: shift.id,
              user_id: u.id,
              type: "STANDBY",
            });
            const assign = assignRes.data;
            const role = standbyIdx === 0 ? "PRIMARY" : "BACKUP";
            await api.post("/standby-details/", {
              assignment: assign.id,
              role,
              phone_number: u.phone_number || "",
            });
            standbyIdx++;
          }
        }
      }
      return { created };
    },
    onSuccess: ({ created }) => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      setShowAddForm(false);
      setForm({ ...form, assign_team: false });
      showToast(`${created.length} shifts processed (created or updated)`, "success");
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, "Failed to generate schedule"), "error");
    },
  });

  const createAssignment = useMutation({
    mutationFn: async (d: { shift_id: number; user_id: string; type: "WORK_HOURS" | "STANDBY"; standby_role?: "PRIMARY" | "BACKUP"; standby_phone?: string }) => {
      const r = await api.post("/assignments/", { shift: d.shift_id, user_id: d.user_id, type: d.type });
      if (d.type === "STANDBY") {
        await api.post("/standby-details/", { assignment: r.data.id, role: d.standby_role || "PRIMARY", phone_number: d.standby_phone || "" });
      }
      return r.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); setAddingAssignmentTo(null); showToast("Assignment created", "success"); },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to create assignment"), "error"),
  });

  const bulkAssignUsers = useMutation({
    mutationFn: async ({ dateStrs, techIds, userIds, type, standbyRole, standbyPhone, techUserMapping }: { 
      dateStrs: string[], 
      techIds: number[], 
      userIds: number[], 
      type: "WORK_HOURS" | "STANDBY",
      standbyRole?: "PRIMARY" | "BACKUP",
      standbyPhone?: string,
      techUserMapping?: Map<number, number[]>,
    }) => {
      for (const dateStr of dateStrs) {
        for (const techId of techIds) {
          // 1. Ensure shift exists
          const res = await api.post("/shifts/", {
            date: dateStr,
            technology_id: techId,
          });
          const shift = res.data as Shift;

          // 2. Determine which users to assign to this tech
          // If techUserMapping provided, use per-tech mapping; otherwise assign all users
          const usersForThisTech = techUserMapping?.has(techId) 
            ? techUserMapping.get(techId)! 
            : userIds;

          // 3. Assign users
          for (const uid of usersForThisTech) {
            const user = users?.find(u => u.id === uid);
            const assignRes = await api.post("/assignments/", {
              shift: shift.id,
              user_id: uid,
              type: type,
            });
            
            if (type === "STANDBY") {
              await api.post("/standby-details/", {
                assignment: assignRes.data.id,
                role: standbyRole || "BACKUP",
                phone_number: standbyPhone || user?.phone_number || "",
              });
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      showToast("Bulk assignment completed", "success");
      setSelectedDates(new Set());
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed bulk assignment"), "error"),
  });

  // Fix defaults: removes wrong users and adds missing default users for WORK_HOURS
  const fixDefaults = useMutation({
    mutationFn: async ({ date_start, date_end, technology_ids }: {
      date_start: string;
      date_end: string;
      technology_ids: number[];
    }) => {
      const res = await api.post("/shifts/fix_defaults/", {
        date_start,
        date_end,
        technology_ids,
      });
      return res.data as { removed: number; added: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      showToast(`Fixed: ${data.removed} removed, ${data.added} added`, "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to fix defaults"), "error"),
  });

  const { deleteShift } = useShiftMutations();

  const bulkDeleteShifts = useMutation({
    mutationFn: async ({ dateStrs, techIds, allDays, assignmentType }: { 
      dateStrs: string[], 
      techIds?: number[], 
      allDays?: boolean,
      assignmentType?: "WORK_HOURS" | "STANDBY" | "ALL"
    }) => {
      if (allDays && techIds && techIds.length > 0) {
        const res = await api.post("/shifts/bulk_delete_by_technology/", {
          technology_ids: techIds,
          assignment_type: assignmentType,
        });
        return res.data.deleted;
      }

      // Traditional bulk delete for selected dates or all techs in those dates
      if (techIds && techIds.length > 0) {
        const sorted = dateStrs.slice().sort();
        const res = await api.post("/shifts/bulk_delete_by_technology/", {
          technology_ids: techIds,
          date_start: sorted[0],
          date_end: sorted[sorted.length - 1],
          assignment_type: assignmentType,
        });
        return res.data.deleted;
      }

      // Fallback for cases where we don't have techIds (delete everything on selected days)
      // This is less common but kept for robustness. We still respect assignmentType.
      const shiftIds: number[] = [];
      dateStrs.forEach((ds) => {
        (shiftsByDay.get(ds) || []).forEach((s) => {
          shiftIds.push(s.id);
        });
      });

      if (assignmentType && assignmentType !== "ALL") {
        // If targeting specific assignment types but without techIds, we still use the bulk API
        // but without technology_ids filter (it will affect all techs on those days)
        const sorted = dateStrs.slice().sort();
        const res = await api.post("/shifts/bulk_delete_by_technology/", {
          technology_ids: [], 
          date_start: sorted[0],
          date_end: sorted[sorted.length - 1],
          assignment_type: assignmentType,
        });
        return res.data.deleted;
      }

      for (const id of shiftIds) await api.delete(`/shifts/${id}/`);
      return shiftIds.length;
    },
    onSuccess: (count, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      const typeLabel = variables.assignmentType === "WORK_HOURS" ? "work hours" : 
                        variables.assignmentType === "STANDBY" ? "standby" : "assignments";
      showToast(`${count} ${typeLabel} deleted`, "success");
      setSelectedDates(new Set());
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to bulk delete shifts"), "error"),
  });

  const teamCount = (form.assign_team && form.technology_id)
    ? (users?.filter((u) => u.technologies?.some((t) => String(t.technology.id) === form.technology_id)).length || 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Shift Management</h3>
          <p className="text-sm text-muted-foreground">Schedule shifts and manage team assignments across technologies.</p>
        </div>
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarRange className="h-5 w-5 text-primary" />
              Configure Schedule
            </h4>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Info className="h-3 w-3" />
              Start and End dates can be identical for single shifts
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); createShifts.mutate(form); }} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Technology</label>
                <select
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.technology_id}
                  onChange={(e) => setForm({ ...form, technology_id: e.target.value })}
                >
                  <option value="">Select Tech...</option>
                  {techs?.filter((t) => isAdmin || isSuperuser || t.role === currentUser?.role).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Internal Notes</label>
                  <span
                    className={cn(
                      "text-[10px]",
                      form.notes.length > MAX_NOTES_LENGTH ? "text-destructive font-medium" : "text-muted-foreground"
                    )}
                  >
                    {form.notes.length} / {MAX_NOTES_LENGTH}
                  </span>
                </div>
                <textarea
                  className="flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  maxLength={MAX_NOTES_LENGTH}
                  placeholder="Optional shift notes..."
                />
                {form.notes.length > MAX_NOTES_LENGTH && (
                  <p className="text-xs text-destructive">
                    Notes must be {MAX_NOTES_LENGTH} characters or fewer.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    form.assign_team ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Autopopulate Team</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-tight">Assign all members of the selected technology automatically</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, assign_team: !form.assign_team })}
                  className={cn(
                    "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    form.assign_team ? "bg-primary" : "bg-input"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    form.assign_team ? "translate-x-5" : "translate-x-1"
                  )} />
                </button>
              </div>

              {form.assign_team && (
                <div className="mt-4 grid gap-4 border-t border-primary/10 pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-primary uppercase tracking-wider">Assignment Type</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-primary/20 bg-background px-3 py-1 text-sm"
                      value={form.assignment_type}
                      onChange={(e) => setForm({ ...form, assignment_type: e.target.value as "WORK_HOURS" | "STANDBY" })}
                    >
                      <option value="WORK_HOURS">Work Hours</option>
                      <option value="STANDBY">Standby Duty</option>
                    </select>
                  </div>
                  <div className="col-span-full flex items-center gap-2 text-[11px] font-medium text-primary">
                    <Check className="h-3 w-3" />
                    Targeting {teamCount} team members based on technology selection.
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={createShifts.isPending || !form.technology_id || form.notes.length > MAX_NOTES_LENGTH}
                className="rounded-lg bg-primary px-10 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
              >
                {createShifts.isPending ? "Generating Shifts..." : "Generate Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingShift && (
        <EditShiftDialog shift={editingShift} onClose={() => setEditingShift(null)} />
      )}

      {addingAssignmentTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h4 className="text-lg font-bold">Add Assignment</h4>
                <p className="text-xs text-muted-foreground">{addingAssignmentTo.date}</p>
              </div>
              <button onClick={() => setAddingAssignmentTo(null)} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createAssignment.mutate({ shift_id: addingAssignmentTo.id, user_id: newAssignment.user_id, type: newAssignment.type, standby_role: newAssignment.standby_role, standby_phone: newAssignment.standby_phone }); }} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Member</label>
                <select
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={newAssignment.user_id}
                  onChange={(e) => {
                    const userId = e.target.value;
                    const user = users?.find((u) => String(u.id) === userId);
                    setNewAssignment({
                      ...newAssignment,
                      user_id: userId,
                      standby_phone: user?.phone_number || "",
                    });
                  }}
                >
                  <option value="">Select user...</option>
                  {filterByRole(users, isAdmin, currentUser?.role).map((u) => <option key={u.id} value={u.id}>{getDisplayName(u)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assignment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAssignment({ ...newAssignment, type: "WORK_HOURS" })}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all",
                      newAssignment.type === "WORK_HOURS" ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border hover:bg-muted"
                    )}
                  >
                    Work Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAssignment({ ...newAssignment, type: "STANDBY" })}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all",
                      newAssignment.type === "STANDBY" ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border hover:bg-muted"
                    )}
                  >
                    Standby
                  </button>
                </div>
              </div>
              {newAssignment.type === "STANDBY" && (
                <div className="grid gap-4 sm:grid-cols-2 animate-in slide-in-from-top-1">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={newAssignment.standby_role}
                      onChange={(e) => setNewAssignment({ ...newAssignment, standby_role: e.target.value as "PRIMARY" | "BACKUP" })}
                    >
                      <option value="PRIMARY">Primary</option>
                      <option value="BACKUP">Backup</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={newAssignment.standby_phone}
                      onChange={(e) => setNewAssignment({ ...newAssignment, standby_phone: e.target.value })}
                      placeholder="+355..."
                    />
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={createAssignment.isPending || !newAssignment.user_id}
                className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
              >
                {createAssignment.isPending ? "Assigning..." : "Confirm Assignment"}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingAssignment && (
        <EditAssignmentDialog
          assignment={editingAssignment}
          onClose={() => {
            setEditingAssignment(null);
            setEditingAssignmentDate(null);
          }}
          dateStr={editingAssignmentDate || undefined}
          shiftAssignments={singleDayShifts?.find(s => s.assignments.some(a => a.id === editingAssignment.id))?.assignments}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[500px]">
        <div className="lg:col-span-3">
          <CalendarMonthView
            month={activeMonth}
            selectedDate={selectedDateStr ? parseISO(selectedDateStr) : null}
            shiftsByDay={shiftsByDay}
            vacationsByDay={vacationsByDay}
            onSelectDate={(date, event) => {
              const dateStr = format(date, "yyyy-MM-dd");
              if (event.ctrlKey || event.metaKey) {
                setSelectedDates((prev) => {
                  const next = new Set(prev);
                  if (next.has(dateStr)) next.delete(dateStr);
                  else next.add(dateStr);
                  return next;
                });
              } else {
                setSelectedDates(new Set([dateStr]));
              }
            }}
            onChangeMonth={setActiveMonth}
            multiSelectedDates={selectedDates}
            onClearSelection={() => setSelectedDates(new Set())}
          />
        </div>
        <div className="lg:col-span-2 flex flex-col min-h-[500px]">
          <AdminDayPanel
            selectedDates={Array.from(selectedDates).sort()}
            singleDayShifts={singleDayShifts?.filter(domainMatch)}
            shiftSummariesByDate={shiftsByDay}
            technologies={techs?.filter((t) => isAdmin || isSuperuser || t.role === currentUser?.role)}
            users={users}
            isLoading={singleDayLoading}
            canManage={canManage}
            isAdmin={isAdmin}
            isSuperuser={currentUser?.is_superuser}
            userRole={currentUser?.role}
            layout={layout}
            onAddUser={(shiftId) => {
              const shift = singleDayShifts?.filter(domainMatch).find((s) => s.id === shiftId) || null;
              setAddingAssignmentTo(shift);
            }}
            onCreateShift={(_dateStr, _techId) => {
              const dates = Array.from(selectedDates).sort();
              const start = dates[0] || format(new Date(), "yyyy-MM-dd");
              const end = dates[dates.length - 1] || start;
              setForm((prev) => ({ ...prev, start_date: start, end_date: end }));
              setShowAddForm(true);
            }}
            onEditShift={setEditingShift}
            onDeleteShift={(id) => deleteShift.mutate(id)}
            onEditAssignment={(a, d) => {
              setEditingAssignment(a);
              setEditingAssignmentDate(d || null);
            }}
            onClearSelection={() => setSelectedDates(new Set())}
            onLayoutChange={setLayout}
            onDeleteShifts={(dateStrs, techIds, allDays, assignmentType) => bulkDeleteShifts.mutate({ dateStrs, techIds, allDays, assignmentType })}
            onBulkAssign={(data) => bulkAssignUsers.mutate(data)}
            onFixDefaults={(data) => fixDefaults.mutate(data)}
          />
        </div>
      </div>
    </div>
  );
}