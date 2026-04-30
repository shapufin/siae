import { useState } from "react";
import { Briefcase, Shield, Plus, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { UserCard } from "./UserCard";
import type { ShiftColumnProps, Assignment } from "../types";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-10 items-center justify-center rounded-xl border border-dashed border-border/40 bg-background/40 px-3 text-center text-[11px] italic text-muted-foreground/40">
      {message}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="ml-auto flex h-4.5 min-w-[20px] items-center justify-center rounded-full bg-secondary/80 px-1.5 text-[10px] font-bold">
        {count}
      </span>
    </div>
  );
}

function AddUserButton({ onClick, className = "mt-2" }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`${className} flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/20 bg-primary/5 py-2 text-[11px] font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/40 active:scale-[0.98]`}
      aria-label="Add user to shift"
    >
      <Plus className="h-3.5 w-3.5" />
      Add User
    </button>
  );
}

interface AssignmentListProps {
  assignments: Assignment[];
  dateStr: string;
  onEditAssignment?: (a: Assignment) => void;
  emptyMessage: string;
}

function AssignmentList({ assignments, dateStr, onEditAssignment, emptyMessage }: AssignmentListProps) {
  if (assignments.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }
  return (
    <>
      {assignments.map((assignment) => (
        <UserCard
          key={assignment.id}
          assignmentId={assignment.id}
          user={assignment.user}
          type={assignment.type}
          standbyDetail={assignment.standby_detail}
          dateStr={dateStr}
          hideTechnology
          compact
          onEdit={onEditAssignment ? () => onEditAssignment(assignment) : undefined}
        />
      ))}
    </>
  );
}

export function ShiftColumn({
  title,
  roleFilter,
  technologies,
  shiftsByTechId,
  isLoading,
  canAddUser,
  canCreateShift,
  isAdmin,
  dateStr,
  layout,
  onAddUser,
  onCreateShift,
  onEditShift,
  onDeleteShift,
  onEditAssignment,
}: ShiftColumnProps) {
  const [expandedTechIds, setExpandedTechIds] = useState<Set<number>>(new Set());
  const [manualToggles, setManualToggles] = useState<Set<number>>(new Set());
  const [activeTabs, setActiveTabs] = useState<Record<number, "work" | "standby">>({});

  const toggleTech = (techId: number) => {
    setManualToggles((prev) => {
      const next = new Set(prev);
      next.add(techId);
      return next;
    });
    setExpandedTechIds((prev) => {
      const next = new Set(prev);
      if (next.has(techId)) next.delete(techId);
      else next.add(techId);
      return next;
    });
  };

  const setTab = (techId: number, tab: "work" | "standby") => {
    setActiveTabs(prev => ({ ...prev, [techId]: tab }));
  };

  const visibleTechs = technologies?.filter((tech) => {
    const shift = shiftsByTechId.get(tech.id);
    if (!shift) return false;

    const roleAssignments =
      shift.assignments.filter((a) => a.user.role === roleFilter) ?? [];

    const hasAssignmentsForRole = roleAssignments.length > 0;
    const isEmptyShift = shift.assignments.length === 0;
    const isVisibleEmptyShift =
      isEmptyShift && (
        shift.created_by?.role === roleFilter ||
        shift.created_by?.is_superuser ||
        isAdmin
      );

    return hasAssignmentsForRole || isVisibleEmptyShift;
  });

  const allExpanded = visibleTechs && visibleTechs.length > 0 && visibleTechs.every(t => expandedTechIds.has(t.id));

  const toggleAll = () => {
    if (!visibleTechs) return;
    const nextManual = new Set(manualToggles);
    visibleTechs.forEach(t => nextManual.add(t.id));
    setManualToggles(nextManual);

    if (allExpanded) {
      setExpandedTechIds(new Set());
    } else {
      setExpandedTechIds(new Set(visibleTechs.map(t => t.id)));
    }
  };

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            {title}
          </h4>
          {visibleTechs && visibleTechs.length > 1 && layout === "stacked" && (
            <button
              onClick={toggleAll}
              className="text-[10px] font-bold text-primary/60 hover:text-primary transition-colors uppercase tracking-tight"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="rounded-xl bg-secondary/30 p-3 text-sm text-muted-foreground animate-pulse">
          Loading...
        </div>
      ) : (
        <>
          {visibleTechs && visibleTechs.length > 0 ? (
            <div className="space-y-3">
              {visibleTechs.map((tech) => {
                const shift = shiftsByTechId.get(tech.id);
                const roleAssignments =
                  shift?.assignments.filter((a) => a.user.role === roleFilter) ?? [];
                const workHours = roleAssignments.filter((a) => a.type === "WORK_HOURS");
                const standby = roleAssignments.filter((a) => a.type === "STANDBY");
                const totalCount = roleAssignments.length;

                const isExpanded = manualToggles.has(tech.id)
                  ? expandedTechIds.has(tech.id)
                  : (totalCount > 0 && visibleTechs.length === 1);

                const activeTab = activeTabs[tech.id] || "work";

                return (
                  <div key={tech.id} className="rounded-xl border border-border/50 bg-secondary/10 transition-all hover:border-border/80 shadow-sm overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tech.color_code, boxShadow: `0 0 10px ${tech.color_code}40` }}
                        />
                        <span className="text-sm font-bold truncate" style={{ color: tech.color_code }} title={tech.name}>
                          {tech.name}
                        </span>
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary/80 px-1.5 text-[10px] font-bold text-muted-foreground shrink-0">
                          {totalCount}
                        </span>
                      </div>

                      {layout === "stacked" ? (
                        <button
                          onClick={() => toggleTech(tech.id)}
                          className="p-1 rounded-md hover:bg-secondary/40 transition-colors"
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      ) : (
                        <div className="flex items-center bg-secondary/40 rounded-lg p-[2px] border border-border/20 shrink-0">
                          <button
                            onClick={() => setTab(tech.id, "work")}
                            className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold transition-all ${
                              activeTab === "work"
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            WORK ({workHours.length})
                          </button>
                          <button
                            onClick={() => setTab(tech.id, "standby")}
                            className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold transition-all ${
                              activeTab === "standby"
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            STBY ({standby.length})
                          </button>
                        </div>
                      )}

                      {shift && (onEditShift || onDeleteShift) && (
                        <div className="flex items-center gap-1 border-l border-border/40 pl-1.5 ml-0.5">
                          {onEditShift && (
                            <button
                              onClick={() => onEditShift(shift)}
                              className="rounded-md p-1.5 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary transition-colors"
                              title="Edit shift notes"
                              aria-label="Edit shift notes"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDeleteShift && (
                            <button
                              onClick={() => {
                                if (confirm(`Permanently delete shift for ${tech.name} on ${dateStr}?`)) {
                                  onDeleteShift(shift.id);
                                }
                              }}
                              className="rounded-md p-1.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                              title="Delete shift"
                              aria-label="Delete shift"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content Body */}
                    {layout === "stacked" ? (
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-1 opacity-100' : 'grid-rows-0 opacity-0'}`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-4 p-3 pt-0">
                            {/* Work Hours Section */}
                            <div className="space-y-2">
                              <SectionHeader icon={Briefcase} label="Work hours" count={workHours.length} />
                              <div className="grid grid-cols-1 gap-2">
                                <AssignmentList
                                  assignments={workHours}
                                  dateStr={dateStr}
                                  onEditAssignment={onEditAssignment}
                                  emptyMessage="No work hours assigned"
                                />
                              </div>
                            </div>

                            {/* Standby Section */}
                            <div className="space-y-2">
                              <SectionHeader icon={Shield} label="Standby coverage" count={standby.length} />
                              <div className="grid grid-cols-1 gap-2">
                                <AssignmentList
                                  assignments={standby}
                                  dateStr={dateStr}
                                  onEditAssignment={onEditAssignment}
                                  emptyMessage="No standby coverage"
                                />
                              </div>
                            </div>

                            {shift && canAddUser && <AddUserButton onClick={() => onAddUser(shift.id)} />}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 pt-0">
                        <div className="min-h-[120px]">
                          {activeTab === "work" ? (
                            <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-200">
                              <AssignmentList
                                assignments={workHours}
                                dateStr={dateStr}
                                onEditAssignment={onEditAssignment}
                                emptyMessage="No work hours assigned"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2 animate-in fade-in slide-in-from-right-2 duration-200">
                              <AssignmentList
                                assignments={standby}
                                dateStr={dateStr}
                                onEditAssignment={onEditAssignment}
                                emptyMessage="No standby coverage"
                              />
                            </div>
                          )}
                        </div>
                        {shift && canAddUser && (
                          <AddUserButton onClick={() => onAddUser(shift.id)} className="mt-4" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-secondary/5 py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground/60">No technology shifts planned</p>
              <p className="text-[11px] text-muted-foreground/40">Select "Add Technology Shift" to begin</p>
            </div>
          )}

          {canCreateShift && onCreateShift && (
            <button
              onClick={() => onCreateShift()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-secondary/10 py-4 text-sm font-bold text-muted-foreground transition-all hover:bg-secondary/30 hover:text-foreground hover:border-primary/40 group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border group-hover:border-primary/40">
                <Plus className="h-4 w-4" />
              </div>
              Add Technology Shift
            </button>
          )}
        </>
      )}
    </div>
  );
}
