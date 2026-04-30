import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Search, Loader2, Users } from "lucide-react";
import { api, useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { cn, getApiErrorMessage, unwrapResults, getDisplayName, getDomainBadgeClass } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import type { Technology, User, CreateShiftDialogProps } from "../types";

const COLOR_PALETTE = [
  { hex: "#ef4444", label: "red" },
  { hex: "#f97316", label: "orange" },
  { hex: "#f59e0b", label: "amber" },
  { hex: "#84cc16", label: "lime" },
  { hex: "#10b981", label: "emerald" },
  { hex: "#06b6d4", label: "cyan" },
  { hex: "#3b82f6", label: "blue" },
  { hex: "#a855f7", label: "purple" },
];

export function CreateShiftDialog({ date, onClose, defaultTechnologyId }: CreateShiftDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isAdmin, isManager } = useAuth();
  const canCreateTech = isAdmin || isManager;

  const [technologyId, setTechnologyId] = useState(String(defaultTechnologyId ?? ""));
  const [notes, setNotes] = useState("");
  const [autoPopulate, setAutoPopulate] = useState(false);

  const [isCreatingTech, setIsCreatingTech] = useState(false);
  const [newTechName, setNewTechName] = useState("");
  const [newTechColor, setNewTechColor] = useState(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].hex);
  const [techSearch, setTechSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(techSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [techSearch]);

  const { data: technologies, isLoading: isLoadingTechs } = useQuery<Technology[]>({
    queryKey: queryKeys.technologies.search(debouncedSearch),
    queryFn: async () => {
      const res = await api.get("/technologies/", {
        params: debouncedSearch ? { search: debouncedSearch } : {},
      });
      return unwrapResults(res);
    },
  });

  const createTechnology = useMutation({
    mutationFn: async () => {
      const res = await api.post("/technologies/", {
        name: newTechName.trim(),
        color_code: newTechColor,
      });
      return res.data as Technology;
    },
    onSuccess: (newTech) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.technologies.all });
      setTechnologyId(String(newTech.id));
      setIsCreatingTech(false);
      setNewTechName("");
      setNewTechColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].hex);
      showToast(`Technology "${newTech.name}" created`, "success");
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, "Failed to create technology");
      showToast(msg, "error");
    },
  });

  const { data: defaultCrew } = useQuery<{ users: User[] } | null>({
    queryKey: queryKeys.technologies.defaultCrew(Number(technologyId)),
    queryFn: async () => {
      if (!technologyId) return null;
      const res = await api.get(`/default-crew/${technologyId}/`);
      return res.data;
    },
    enabled: !!technologyId,
  });

  const crewUsers = defaultCrew?.users ?? [];
  const hasDefaultCrew = crewUsers.length > 0;

  const createShift = useMutation({
    mutationFn: async () => {
      const res = await api.post("/shifts/", {
        technology_id: Number(technologyId),
        date,
        notes,
        auto_populate: autoPopulate,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
      showToast("Shift created successfully", "success");
      onClose();
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, "Failed to create shift");
      showToast(msg, "error");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!technologyId) return;
    createShift.mutate();
  };

  const selectedTech = technologies?.find((t) => String(t.id) === technologyId);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Shift</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="shift-tech" className="text-sm font-medium">Technology</label>

            <div className="relative">
              <input
                id="shift-tech"
                type="text"
                value={isCreatingTech ? "+ Create New" : techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                onFocus={() => {
                  if (selectedTech) {
                    setTechnologyId("");
                    setTechSearch("");
                  }
                }}
                placeholder={selectedTech ? selectedTech.name : "Search or select a technology..."}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm pr-8"
              />
              {!isCreatingTech && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isLoadingTechs ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : selectedTech ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: selectedTech.color_code }}
                    />
                  ) : (
                    <Search className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>

            {/* Dropdown options */}
            {!isCreatingTech && techSearch.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background shadow-sm">
                {technologies && technologies.length > 0 ? (
                  technologies.map((tech) => (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTechnologyId(String(tech.id));
                        setTechSearch("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60 transition-colors"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: tech.color_code }}
                      />
                      <span className="flex-1 text-left">{tech.name}</span>
                      <span className={cn("text-[9px] font-bold uppercase tracking-wider rounded border px-1", getDomainBadgeClass(tech.role))}>
                        {tech.role}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No technologies found.</p>
                )}
                {canCreateTech && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingTech(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border/60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create New Technology
                  </button>
                )}
              </div>
            )}

            {/* Technology list when no search active */}
            {!isCreatingTech && techSearch.length === 0 && !selectedTech && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background shadow-sm">
                {technologies && technologies.length > 0 ? (
                  technologies.map((tech) => (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={() => setTechnologyId(String(tech.id))}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                        technologyId === String(tech.id) ? "bg-secondary/60" : "hover:bg-secondary/60"
                      )}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: tech.color_code }}
                      />
                      <span className="flex-1 text-left">{tech.name}</span>
                      <span className={cn("text-[9px] font-bold uppercase tracking-wider rounded border px-1", getDomainBadgeClass(tech.role))}>
                        {tech.role}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No technologies available.</p>
                )}
                {canCreateTech && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingTech(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border/60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create New Technology
                  </button>
                )}
              </div>
            )}

            {/* Selected technology chip */}
            {selectedTech && !isCreatingTech && (
              <div className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedTech.color_code }}
                />
                <span className="font-medium">{selectedTech.name}</span>
                <span className={cn("text-[9px] font-bold uppercase tracking-wider rounded border px-1", getDomainBadgeClass(selectedTech.role))}>
                  {selectedTech.role}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTechnologyId("");
                    setTechSearch("");
                  }}
                  className="ml-auto rounded p-0.5 hover:bg-secondary transition-colors"
                  aria-label="Clear selection"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Inline technology creation form */}
            {isCreatingTech && (
              <div className="rounded-lg border border-border/80 bg-secondary/20 p-4 space-y-3">
                <h4 className="text-sm font-medium">Create Technology</h4>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="new-tech-name" className="text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      id="new-tech-name"
                      type="text"
                      value={newTechName}
                      onChange={(e) => setNewTechName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newTechName.trim()) createTechnology.mutate();
                        }
                      }}
                      placeholder="e.g., Kubernetes, React Native"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Color</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {COLOR_PALETTE.map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setNewTechColor(color.hex)}
                          className={cn(
                            "h-7 w-7 rounded-full border-2 transition-all",
                            newTechColor === color.hex
                              ? "border-white ring-2 ring-primary scale-110"
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: color.hex }}
                          title={color.label}
                          aria-label={`Select ${color.label} color`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingTech(false);
                        setNewTechName("");
                      }}
                      className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (newTechName.trim()) createTechnology.mutate();
                      }}
                      disabled={createTechnology.isPending || !newTechName.trim()}
                      className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {createTechnology.isPending ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="shift-date" className="text-sm font-medium">Date</label>
            <input
              id="shift-date"
              type="date"
              value={date}
              disabled
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          {hasDefaultCrew && (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Preload Default Crew</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPopulate((v) => !v)}
                  className={cn(
                    "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    autoPopulate ? "bg-primary" : "bg-input"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    autoPopulate ? "translate-x-5" : "translate-x-1"
                  )} />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Automatically assign default work hours members for this technology.
              </p>
              {autoPopulate && (
                <div className="flex flex-wrap gap-1.5">
                  {crewUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                    >
                      {getDisplayName(u)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="shift-notes" className="text-sm font-medium">Notes</label>
            <textarea
              id="shift-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          {createShift.isError && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-xs font-medium text-destructive">
                {getApiErrorMessage(createShift.error, "Failed to create shift. Please try again.")}
              </p>
            </div>
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
              disabled={createShift.isPending || !technologyId || isNaN(Number(technologyId))}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {createShift.isPending ? "Creating..." : "Create Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
