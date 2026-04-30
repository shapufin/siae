import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { LayoutList, Layout } from "lucide-react";
import { api, useAuth } from "../contexts/AuthContext";
import { useShiftStore } from "../stores/shiftStore";
import { canEditAssignment, canEditShift, canAddToColumn } from "../lib/permissions";
import { unwrapResults } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import { ShiftColumn } from "./ShiftColumn";
import { AddAssignmentDialog } from "./AddAssignmentDialog";
import { EditShiftDialog } from "./EditShiftDialog";
import { EditAssignmentDialog } from "./EditAssignmentDialog";
import { useShiftMutations } from "../hooks/useShiftMutations";
import { CreateShiftDialog } from "./CreateShiftDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import type { Shift, Technology, DayDrawerProps, Assignment } from "../types";

export function DayDrawer({ date, onClose }: DayDrawerProps) {
  const { isAdmin, isManager, isReadOnly, user } = useAuth();
  const { sidebarLayout, setSidebarLayout } = useShiftStore();
  const userRole = user?.role;
  const isCR = userRole === "CR";
  const ctx = { user, isAdmin, isManager, isReadOnly };
  const canEditAssignmentFlag = canEditAssignment(ctx);
  const canEditShiftSIAE = canEditShift(ctx, "SIAE");
  const canEditShiftENG = canEditShift(ctx, "ENG");
  const dateStr = format(date, "yyyy-MM-dd");
  const [addShiftId, setAddShiftId] = useState<number | null>(null);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [createShiftTechId, setCreateShiftTechId] = useState<number | undefined>(undefined);
  const [editingShift, setEditingShift] = useState<{ id: number; notes: string } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const { deleteShift } = useShiftMutations();
  const handleEditAssignment = (a: Assignment) => setEditingAssignment(a);

  const { data: shifts, isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: [...queryKeys.shifts.admin(dateStr), user?.id ?? "anonymous"],
    queryFn: async () => unwrapResults(await api.get<Shift[]>(`/shifts/?date=${dateStr}&all=true`)),
  });

  const { data: technologies, isLoading: techsLoading } = useQuery<Technology[]>({
    queryKey: [...queryKeys.technologies.all, user?.id ?? "anonymous"],
    queryFn: async () => unwrapResults(await api.get<Technology[]>("/technologies/?all=true")),
  });

  const shiftsByTechId = useMemo(() => {
    const map = new Map<number, Shift>();
    shifts?.forEach((s) => map.set(s.technology.id, s));
    return map;
  }, [shifts]);

  // Find technologyId for the editingAssignment
  const editingAssignmentTechId = editingAssignment 
    ? shifts?.find(s => s.assignments.some(a => a.id === editingAssignment.id))?.technology.id
    : undefined;

  // Permission flags now centralized via permissions.ts
  const totalAssignments =
    shifts?.reduce((acc, s) => acc + s.assignments.length, 0) ?? 0;

  return (
    <>
      <Sheet open={!addShiftId && !editingShift && !editingAssignment && !showCreateShift} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="inset-y-4 right-4 h-auto w-[90vw] md:w-[800px] rounded-2xl border bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-3xl overflow-hidden flex flex-col">
          <div className="flex flex-col h-full">
            <SheetHeader className="border-b border-border p-3 shrink-0">
              <SheetDescription className="sr-only">
                Day details for {format(date, "MMMM d, yyyy")}
              </SheetDescription>
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-lg font-semibold tracking-tight">
                    {format(date, "EEEE")}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    {format(date, "MMMM d, yyyy")}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Layout Toggle */}
                  <div className="flex items-center bg-secondary/30 rounded-lg p-1 border border-border/40">
                    <button
                      onClick={() => setSidebarLayout("stacked")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        sidebarLayout === "stacked" 
                          ? "bg-background text-primary shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Stacked View (Accordion)"
                    >
                      <LayoutList className="h-3 w-3" />
                      STACKED
                    </button>
                    <button
                      onClick={() => setSidebarLayout("tabbed")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        sidebarLayout === "tabbed" 
                          ? "bg-background text-primary shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Tabbed View"
                    >
                      <Layout className="h-3 w-3" />
                      TABBED
                    </button>
                  </div>

                  <div className="flex items-center gap-2 border-l border-border/50 pl-4">
                    {totalAssignments > 0 && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                        {totalAssignments} assignments
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>
            <div className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 lg:grid-cols-[1fr_auto_1fr] content-start min-h-0">
              {/* CLIENT (SIAE) Column */}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/80">
                    Client (SIAE)
                  </span>
                  <div className="ml-auto h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent" />
                </div>
                <ShiftColumn
                  roleFilter="SIAE"
                  technologies={technologies}
                  shiftsByTechId={shiftsByTechId}
                  isLoading={shiftsLoading || techsLoading}
                  canAddUser={canAddToColumn(ctx, "SIAE") && !isCR}
                  canCreateShift={canEditShiftSIAE}
                  isAdmin={isAdmin}
                  dateStr={dateStr}
                  layout={sidebarLayout}
                  onAddUser={setAddShiftId}
                  onCreateShift={() => {
                    setCreateShiftTechId(undefined);
                    setShowCreateShift(true);
                  }}
                  onEditShift={canEditShiftSIAE ? (shift) => setEditingShift({ id: shift.id, notes: shift.notes || "" }) : undefined}
                  onDeleteShift={canEditShiftSIAE ? (id) => deleteShift.mutate(id) : undefined}
                  onEditAssignment={canEditAssignmentFlag ? handleEditAssignment : undefined}
                />
              </div>

              {/* Visual Separator */}
              <div className="hidden lg:flex flex-col items-center gap-1 py-4">
                <div className="w-px flex-1 bg-gradient-to-b from-transparent via-border/60 to-transparent" />
                <div className="flex flex-col items-center gap-1 rounded-full border border-border/40 bg-secondary/30 p-1.5 backdrop-blur-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Client" />
                  <div className="h-3 w-px bg-border/60" />
                  <div className="h-1.5 w-1.5 rounded-full bg-sky-500" title="Consultant" />
                </div>
                <div className="w-px flex-1 bg-gradient-to-b from-transparent via-border/60 to-transparent" />
              </div>

              {/* CONSULTANT (ENG) Column */}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400/80">
                    Consultant (ENG)
                  </span>
                  <div className="ml-auto h-px flex-1 bg-gradient-to-r from-sky-500/20 to-transparent" />
                </div>
                <ShiftColumn
                  roleFilter="ENG"
                  technologies={technologies}
                  shiftsByTechId={shiftsByTechId}
                  isLoading={shiftsLoading || techsLoading}
                  canAddUser={canAddToColumn(ctx, "ENG") && !isCR}
                  canCreateShift={canEditShiftENG}
                  isAdmin={isAdmin || !!user?.is_superuser}
                  dateStr={dateStr}
                  layout={sidebarLayout}
                  onAddUser={setAddShiftId}
                  onCreateShift={() => {
                    setCreateShiftTechId(undefined);
                    setShowCreateShift(true);
                  }}
                  onEditShift={canEditShiftENG ? (shift) => setEditingShift({ id: shift.id, notes: shift.notes || "" }) : undefined}
                  onDeleteShift={canEditShiftENG ? (id) => deleteShift.mutate(id) : undefined}
                  onEditAssignment={canEditShiftENG ? handleEditAssignment : undefined}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {addShiftId !== null && (
        <AddAssignmentDialog
          shiftId={addShiftId}
          date={dateStr}
          onClose={() => setAddShiftId(null)}
        />
      )}

      {editingShift && (
        <EditShiftDialog shift={editingShift} onClose={() => setEditingShift(null)} />
      )}

      {editingAssignment && (
        <EditAssignmentDialog
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          technologyId={editingAssignmentTechId}
          dateStr={dateStr}
          shiftAssignments={shifts?.find(s => s.assignments.some(a => a.id === editingAssignment.id))?.assignments}
        />
      )}

      {showCreateShift && (
        <CreateShiftDialog
          date={dateStr}
          defaultTechnologyId={createShiftTechId}
          onClose={() => {
            setShowCreateShift(false);
            setCreateShiftTechId(undefined);
          }}
        />
      )}
    </>
  );
}
