import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { LayoutList, Layout, X, CalendarDays, Trash2, Filter, Users, Check, Search, ChevronDown, Info } from "lucide-react";
import { ShiftColumn } from "./ShiftColumn";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import { cn, getDisplayName, getDomainColor, getDomainBadgeClass } from "../lib/utils";
import type { AdminDayPanelProps, Technology } from "../types";

export function AdminDayPanel({
  selectedDates,
  singleDayShifts,
  shiftSummariesByDate,
  technologies,
  users,
  isLoading,
  canManage,
  isAdmin,
  isSuperuser,
  userRole,
  layout,
  onAddUser,
  onCreateShift,
  onEditShift,
  onDeleteShift,
  onEditAssignment,
  onClearSelection,
  onLayoutChange,
  onDeleteShifts,
  onBulkAssign,
}: AdminDayPanelProps) {
  const [selectedTechIds, setSelectedTechIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"WORK_HOURS" | "STANDBY_PRIMARY" | "STANDBY_BACKUP">("WORK_HOURS");
  const [deleteAllDays, setDeleteAllDays] = useState(false);
  const { client_role_label, consultant_role_label } = useSiteSettings();

  // Find all technologies present across selected days
  const techsInSelectedDays = useMemo(() => {
    const techMap = new Map<number, Technology>();
    selectedDates.forEach(dateStr => {
      const summaries = shiftSummariesByDate?.get(dateStr) || [];
      summaries.forEach(s => {
        if (!techMap.has(s.technology.id)) {
          techMap.set(s.technology.id, s.technology);
        }
      });
    });
    const allTechs = Array.from(techMap.values());
    // Filter by domain for non-admin users
    if (isAdmin || isSuperuser) return allTechs;
    return allTechs.filter(t => t.role === userRole);
  }, [selectedDates, shiftSummariesByDate, isAdmin, isSuperuser, userRole]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (isAdmin || isSuperuser) return users;
    return users.filter(u => u.role === userRole);
  }, [users, isAdmin, isSuperuser, userRole]);

  if (selectedDates.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-secondary/5 p-8 text-center">
        <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground/60">No day selected</p>
        <p className="text-[11px] text-muted-foreground/40 mt-1">
          Click a day in the calendar to view and manage shifts.
        </p>
        <p className="text-[11px] text-muted-foreground/40 mt-1">
          Ctrl/Cmd + click to multi-select days for bulk actions.
        </p>
      </div>
    );
  }

  if (selectedDates.length === 1) {
    const dateStr = selectedDates[0];
    const date = parseISO(dateStr);
    const shiftsByTechId = new Map<number, import("../types").Shift>();
    singleDayShifts?.forEach((s) => shiftsByTechId.set(s.technology.id, s));

    const canCreateShiftSIAE = isAdmin || (canManage && userRole === "SIAE");
    const canCreateShiftENG = isAdmin || (canManage && userRole === "ENG");
    const canAddToColumn = (role: "SIAE" | "ENG") =>
      isAdmin || !!isSuperuser || (canManage && userRole === role);
    const showSIAEColumn = isAdmin || !!isSuperuser || userRole === "SIAE";
    const showENGColumn = isAdmin || !!isSuperuser || userRole === "ENG";

    return (
      <div className="flex h-full flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div aria-live="polite" aria-atomic="true">
            <h3 className="text-lg font-semibold tracking-tight">{format(date, "EEEE")}</h3>
            <p className="text-xs text-muted-foreground">{format(date, "MMMM d, yyyy")}</p>
          </div>
          <div className="flex items-center gap-3">
            {onLayoutChange && (
              <div className="flex items-center bg-secondary/30 rounded-lg p-1 border border-border/40">
                <button
                  onClick={() => onLayoutChange("stacked")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                    layout === "stacked"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Stacked View"
                >
                  <LayoutList className="h-3 w-3" />
                  Stacked
                </button>
                <button
                  onClick={() => onLayoutChange("tabbed")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                    layout === "tabbed"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Tabbed View"
                >
                  <Layout className="h-3 w-3" />
                  Tabs
                </button>
              </div>
            )}
            <button
              onClick={onClearSelection}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto content-start min-h-0 flex-1">
          {showSIAEColumn && (
            <ShiftColumn
              title={`${client_role_label} (SIAE)`}
              roleFilter="SIAE"
              technologies={technologies}
              shiftsByTechId={shiftsByTechId}
              isLoading={isLoading}
              canAddUser={canAddToColumn("SIAE")}
              canCreateShift={canCreateShiftSIAE}
              isAdmin={isAdmin}
              dateStr={dateStr}
              layout={layout}
              onAddUser={onAddUser}
              onCreateShift={(techId) => onCreateShift(dateStr, techId)}
              onEditShift={onEditShift}
              onDeleteShift={onDeleteShift}
              onEditAssignment={canAddToColumn("SIAE") ? (a) => onEditAssignment(a, dateStr) : undefined}
            />
          )}
          {showENGColumn && (
            <ShiftColumn
              title={`${consultant_role_label} (ENG)`}
              roleFilter="ENG"
              technologies={technologies}
              shiftsByTechId={shiftsByTechId}
              isLoading={isLoading}
              canAddUser={canAddToColumn("ENG")}
              canCreateShift={canCreateShiftENG}
              isAdmin={isAdmin}
              dateStr={dateStr}
              layout={layout}
              onAddUser={onAddUser}
              onCreateShift={(techId) => onCreateShift(dateStr, techId)}
              onEditShift={onEditShift}
              onDeleteShift={onDeleteShift}
              onEditAssignment={canAddToColumn("ENG") ? (a) => onEditAssignment(a, dateStr) : undefined}
            />
          )}
        </div>
      </div>
    );
  }

  // Multi-select summary
  const sortedDates = selectedDates.slice().sort();

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
        <div aria-live="polite" aria-atomic="true">
          <h3 className="text-lg font-semibold tracking-tight">{selectedDates.length} days selected</h3>
          <p className="text-xs text-muted-foreground">Bulk operations available</p>
        </div>
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedDates.map((dateStr) => {
          const date = parseISO(dateStr);
          const summaries = shiftSummariesByDate?.get(dateStr) || [];
          return (
            <div
              key={dateStr}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 shadow-sm"
            >
              <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-secondary/50 border border-border shrink-0">
                <span className="text-[10px] font-bold uppercase leading-none text-muted-foreground">
                  {format(date, "MMM")}
                </span>
                <span className="text-base font-bold leading-none mt-0.5">{format(date, "dd")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {format(date, "EEEE")}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {summaries.length === 0 ? (
                    <span className="text-[11px] italic text-muted-foreground/50">No shifts</span>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {[...summaries].sort((a, b) => {
                          const order = { SIAE: 0, ENG: 1, CR: 2 };
                          return (order[a.technology.role as keyof typeof order] ?? 2) - (order[b.technology.role as keyof typeof order] ?? 2);
                        }).map((s) => (
                          <div
                            key={s.id}
                            className="h-2 w-2 rounded-full border border-solid"
                            style={{
                              backgroundColor: s.technology.color_code,
                              borderColor: getDomainColor(s.technology.role),
                            }}
                            title={`[${s.technology.role}] ${s.technology.name} (${s.assignment_count} assignments)`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {summaries.reduce((acc, s) => acc + s.assignment_count, 0)} assignments across {summaries.length} techs
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedDates.length > 1 && (
        <div className="shrink-0 space-y-4 pt-2 border-t border-border">
          {/* Tech Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                <Filter className="h-3 w-3" />
                1. Target Technologies
              </h4>
              {selectedTechIds.length > 0 && (
                <button onClick={() => setSelectedTechIds([])} className="text-[10px] font-medium text-primary hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(technologies || techsInSelectedDays).map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => {
                    setSelectedTechIds(prev =>
                      prev.includes(tech.id) ? prev.filter(id => id !== tech.id) : [...prev, tech.id]
                    );
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all ${
                    selectedTechIds.includes(tech.id)
                      ? "bg-primary/10 border-primary/30 text-primary shadow-sm ring-1 ring-primary/20"
                      : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary/80 hover:border-border"
                  }`}
                >
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tech.color_code }} />
                  {tech.name}
                  <span className={cn("rounded border px-1 text-[8px] font-bold uppercase tracking-wider", getDomainBadgeClass(tech.role))}>
                    {tech.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* User Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                2. Select Team Members
              </h4>
              {selectedUserIds.length > 0 && (
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Clear ({selectedUserIds.length})
                </button>
              )}
            </div>

            <div className="relative">
              {/* Dropdown Trigger & Search Input */}
              <div
                className={`relative flex min-h-[40px] w-full flex-wrap gap-1.5 rounded-lg border border-border/50 bg-secondary/10 p-1.5 transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 ${
                  isUserDropdownOpen ? "border-primary/40 ring-1 ring-primary/20" : ""
                }`}
              >
                {/* Selected User Tags */}
                {selectedUserIds.map((uid) => {
                  const u = users?.find((u) => u.id === uid);
                  if (!u) return null;
                  return (
                    <span
                      key={uid}
                      className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary animate-in fade-in zoom-in-95 duration-200"
                    >
                      {u.first_name || u.username}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUserIds((prev) => prev.filter((id) => id !== uid));
                        }}
                        className="rounded-full p-0.5 hover:bg-primary/20"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  );
                })}

                <div className="flex flex-1 items-center gap-2">
                  <Search className="h-3 w-3 text-muted-foreground/40 shrink-0 ml-1" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      if (!isUserDropdownOpen) setIsUserDropdownOpen(true);
                    }}
                    onFocus={() => setIsUserDropdownOpen(true)}
                    placeholder={selectedUserIds.length === 0 ? "Search team members..." : ""}
                    className="w-full bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="rounded-md p-1 hover:bg-secondary/40 transition-colors"
                  >
                    <ChevronDown
                      className={`h-3 w-3 text-muted-foreground/60 transition-transform duration-200 ${
                        isUserDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Dropdown Menu */}
              {isUserDropdownOpen && (
                <div className="absolute left-0 top-full z-[100] mt-1.5 w-full overflow-hidden rounded-xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-56 overflow-y-auto p-1 scrollbar-thin">
                    {filteredUsers
                      .filter((u) => {
                        const search = userSearch.toLowerCase();
                        return (
                          u.username.toLowerCase().includes(search) ||
                          u.first_name.toLowerCase().includes(search) ||
                          u.last_name.toLowerCase().includes(search)
                        );
                      })
                      .map((u) => {
                        const isSelected = selectedUserIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserIds((prev) =>
                                isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              );
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] transition-all ${
                              isSelected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "hover:bg-secondary/60 text-muted-foreground"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span>{getDisplayName(u)}</span>
                              <span className="text-[9px] opacity-60 uppercase tracking-tighter">
                                {u.username} • {u.role}
                              </span>
                            </div>
                            {isSelected && <Check className="h-3 w-3 shrink-0" />}
                          </button>
                        );
                      })}
                    {filteredUsers.length === 0 && (
                      <div className="px-3 py-4 text-center text-[11px] text-muted-foreground italic">
                        No team members found
                      </div>
                    )}
                  </div>
                  {userSearch && (
                    <div className="border-t border-border/40 bg-secondary/5 px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground">
                        Filtering by "{userSearch}"
                      </span>
                      <button
                        onClick={() => setUserSearch("")}
                        className="text-[9px] font-bold text-primary hover:underline"
                      >
                        Clear Filter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Click backdrop to close dropdown */}
            {isUserDropdownOpen && (
              <div
                className="fixed inset-0 z-[90]"
                onClick={() => setIsUserDropdownOpen(false)}
              />
            )}
          </div>

          {/* Assignment Type - 3 Button System */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              3. Assignment Type
            </h4>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setBulkAction("WORK_HOURS")}
                className={`px-2 py-2 rounded-lg text-[9px] font-bold transition-all border ${
                  bulkAction === "WORK_HOURS"
                    ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                    : "bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                WORK HOURS
              </button>
              <button
                onClick={() => setBulkAction("STANDBY_PRIMARY")}
                disabled={selectedUserIds.length > 1}
                title={selectedUserIds.length > 1 ? "Select only 1 user for Primary role" : "First user becomes Primary (auto-relegates existing Primary to Backup)"}
                className={`px-2 py-2 rounded-lg text-[9px] font-bold transition-all border relative ${
                  bulkAction === "STANDBY_PRIMARY"
                    ? "bg-orange-50 border-orange-200 text-orange-700 shadow-sm"
                    : "bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/50"
                } ${selectedUserIds.length > 1 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <span className="flex items-center justify-center gap-1">
                  STANDBY
                  <span className="px-1 py-0.5 rounded-[2px] bg-orange-200/50 text-[8px] leading-none">PRIMARY</span>
                </span>
              </button>
              <button
                onClick={() => setBulkAction("STANDBY_BACKUP")}
                className={`px-2 py-2 rounded-lg text-[9px] font-bold transition-all border ${
                  bulkAction === "STANDBY_BACKUP"
                    ? "bg-slate-100 border-slate-300 text-slate-700 shadow-sm"
                    : "bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="flex items-center justify-center gap-1">
                  STANDBY
                  <span className="px-1 py-0.5 rounded-[2px] bg-slate-200/50 text-[8px] leading-none">BACKUP</span>
                </span>
              </button>
            </div>
            {selectedUserIds.length > 1 && bulkAction === "STANDBY_PRIMARY" && (
              <p className="text-[9px] text-orange-600 font-medium">
                Note: First selected user will be PRIMARY, others will be BACKUP
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2 border-t border-border">
            <button
              disabled={selectedTechIds.length === 0 || selectedUserIds.length === 0}
              onClick={() => {
                if (onBulkAssign) {
                  const type = bulkAction === "WORK_HOURS" ? "WORK_HOURS" : "STANDBY";
                  const standbyRole = bulkAction === "STANDBY_PRIMARY" ? "PRIMARY" : bulkAction === "STANDBY_BACKUP" ? "BACKUP" : undefined;
                  onBulkAssign({
                    dateStrs: selectedDates,
                    techIds: selectedTechIds,
                    userIds: selectedUserIds,
                    type,
                    standbyRole,
                  });
                  setSelectedUserIds([]);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Bulk Assignment
            </button>

            <div className="flex flex-col gap-4 pt-3 border-t border-border/60">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-1.5">
                    <Trash2 className="h-3 w-3" />
                    Destructive Actions
                  </h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="deleteAllDays"
                      checked={deleteAllDays}
                      onChange={(e) => setDeleteAllDays(e.target.checked)}
                      className="h-3 w-3 rounded border-border text-destructive focus:ring-destructive"
                    />
                    <label htmlFor="deleteAllDays" className="text-[9px] font-bold text-destructive/80 uppercase tracking-tighter cursor-pointer hover:text-destructive">
                      History Mode
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      const techNames = selectedTechIds.length > 0
                        ? techsInSelectedDays.filter(t => selectedTechIds.includes(t.id)).map(t => t.name).join(", ")
                        : "all technologies";
                      const scope = deleteAllDays ? "ALL DAYS in history" : `${selectedDates.length} selected days`;
                      if (confirm(`Delete WORK HOURS assignments for ${techNames} on ${scope}?`)) {
                        onDeleteShifts?.(selectedDates, selectedTechIds, deleteAllDays, "WORK_HOURS");
                      }
                    }}
                    disabled={selectedTechIds.length === 0}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-blue-200/50 bg-blue-50/30 py-3 text-[9px] font-bold text-blue-700 hover:bg-blue-100/50 hover:border-blue-300 transition-all disabled:opacity-30 group"
                  >
                    <div className="rounded-full bg-blue-100 p-1.5 group-hover:scale-110 transition-transform">
                      <Trash2 className="h-3 w-3" />
                    </div>
                    <span>WORK HOURS</span>
                  </button>
                  <button
                    onClick={() => {
                      const techNames = selectedTechIds.length > 0
                        ? techsInSelectedDays.filter(t => selectedTechIds.includes(t.id)).map(t => t.name).join(", ")
                        : "all technologies";
                      const scope = deleteAllDays ? "ALL DAYS in history" : `${selectedDates.length} selected days`;
                      if (confirm(`Delete STANDBY assignments for ${techNames} on ${scope}?`)) {
                        onDeleteShifts?.(selectedDates, selectedTechIds, deleteAllDays, "STANDBY");
                      }
                    }}
                    disabled={selectedTechIds.length === 0}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-orange-200/50 bg-orange-50/30 py-3 text-[9px] font-bold text-orange-700 hover:bg-orange-100/50 hover:border-orange-300 transition-all disabled:opacity-30 group"
                  >
                    <div className="rounded-full bg-orange-100 p-1.5 group-hover:scale-110 transition-transform">
                      <Trash2 className="h-3 w-3" />
                    </div>
                    <span>STANDBY</span>
                  </button>
                  <button
                    onClick={() => {
                      const techNames = selectedTechIds.length > 0
                        ? techsInSelectedDays.filter(t => selectedTechIds.includes(t.id)).map(t => t.name).join(", ")
                        : "all technologies";
                      const scope = deleteAllDays ? "ALL DAYS in history" : `${selectedDates.length} selected days`;
                      if (confirm(`Delete ALL assignments for ${techNames} on ${scope}?`)) {
                        onDeleteShifts?.(selectedDates, selectedTechIds, deleteAllDays, "ALL");
                      }
                    }}
                    disabled={selectedTechIds.length === 0}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 py-3 text-[9px] font-bold text-destructive hover:bg-destructive hover:text-white transition-all disabled:opacity-30 group"
                  >
                    <div className="rounded-full bg-destructive/10 p-1.5 group-hover:scale-110 transition-transform group-hover:bg-white/20">
                      <Trash2 className="h-3 w-3" />
                    </div>
                    <span>ALL DATA</span>
                  </button>
                </div>

                {deleteAllDays && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 animate-pulse border border-destructive/20">
                    <Info className="h-3 w-3 text-destructive shrink-0" />
                    <p className="text-[9px] font-bold text-destructive uppercase tracking-tight">
                      DANGER: Operations will affect entire historical data for selected technologies.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
