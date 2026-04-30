import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, Pencil, Info, Hash, Palette } from "lucide-react";
import { api, useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { cn, getApiErrorMessage, unwrapResults } from "../../lib/utils";
import { queryKeys } from "../../lib/queryKeys";
import type { Technology } from "../../types";

export function TechnologiesTab() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isAdmin, isManager, user } = useAuth();
  const canManage = isAdmin || isManager;
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Technology | null>(null);
  const [newT, setNewT] = useState({ name: "", slug: "", color_code: "#3b82f6", role: isAdmin ? "CR" : (user?.role || "CR") });

  const { data: techs, isLoading } = useQuery<Technology[]>({
    queryKey: queryKeys.technologies.all,
    queryFn: async () => unwrapResults(await api.get<Technology[]>("/technologies/")),
  });

  const visibleTechs = useMemo(() => {
    if (!techs) return [];
    if (isAdmin || user?.role === "CR") return techs;
    return techs.filter((t) => t.role === user?.role);
  }, [techs, isAdmin, user?.role]);

  const create = useMutation({
    mutationFn: (d: typeof newT) => api.post("/technologies/", d).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.technologies.all });
      setShowCreate(false);
      setNewT({ name: "", slug: "", color_code: "#3b82f6", role: isAdmin ? "CR" : (user?.role || "CR") });
      showToast("Technology created successfully", "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to create technology"), "error"),
  });

  const update = useMutation({
    mutationFn: (d: Technology) => api.patch(`/technologies/${d.slug}/`, d).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.technologies.all });
      setEditing(null);
      showToast("Technology updated successfully", "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to update technology"), "error"),
  });

  const remove = useMutation({
    mutationFn: (slug: string) => api.delete(`/technologies/${slug}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.technologies.all });
      showToast("Technology deleted successfully", "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to delete technology"), "error"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Technologies</h3>
          <p className="text-sm text-muted-foreground">Define and manage technical categories for scheduling.</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowCreate(!showCreate); setEditing(null); }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm",
              showCreate ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "Cancel" : "Add Technology"}
          </button>
        )}
      </div>

      {(showCreate || editing) && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-base font-semibold">
              {editing ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editing ? `Edit: ${editing.name}` : "Configure New Technology"}
            </h4>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Info className="h-3 w-3" />
              Slug should be unique and lowercase
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) update.mutate(editing);
              else create.mutate(newT);
            }}
            className="space-y-6"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Technology Name</label>
                <div className="relative">
                  <input
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={editing ? editing.name : newT.name}
                    onChange={(e) => editing ? setEditing({ ...editing, name: e.target.value }) : setNewT({ ...newT, name: e.target.value })}
                    placeholder="e.g., Kubernetes"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Unique Slug</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Hash className="h-3.5 w-3.5" /></span>
                  <input
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={editing ? editing.slug : newT.slug}
                    onChange={(e) => editing ? setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }) : setNewT({ ...newT, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="kubernetes"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Owner Domain</label>
                <select
                  disabled={!isAdmin}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
                  value={editing ? editing.role : newT.role}
                  onChange={(e) => {
                    const role = e.target.value as "CR" | "SIAE" | "ENG";
                    if (editing) setEditing({ ...editing, role });
                    else setNewT({ ...newT, role });
                  }}
                >
                  <option value="CR">Global / Read-Only (CR)</option>
                  <option value="SIAE">Client Domain (SIAE)</option>
                  <option value="ENG">Consultant Domain (ENG)</option>
                </select>
                {!isAdmin && (
                  <p className="text-[10px] text-muted-foreground italic">Domain is fixed to your current role.</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium leading-none">Brand Color</label>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <input
                      type="color"
                      className="h-12 w-24 cursor-pointer rounded-lg border border-input bg-background p-1"
                      value={editing ? editing.color_code : newT.color_code}
                      onChange={(e) => editing ? setEditing({ ...editing, color_code: e.target.value }) : setNewT({ ...newT, color_code: e.target.value })}
                    />
                    <Palette className="absolute -right-2 -top-2 h-4 w-4 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground">Select a color to represent this technology in the calendar.</p>
                    <code className="text-[10px] font-bold text-primary">{editing ? editing.color_code : newT.color_code}</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setEditing(null); }}
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending || update.isPending}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {create.isPending || update.isPending ? "Syncing..." : editing ? "Save Changes" : "Create Technology"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Technology</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Slug</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Owner Domain</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Hex Code</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading technologies...</td></tr>
              ) : visibleTechs.length ? visibleTechs.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: t.color_code, boxShadow: `0 0 10px ${t.color_code}40` }} />
                      {t.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.slug}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm",
                      t.role === "ENG" && "border-info/20 bg-info/5 text-info",
                      t.role === "SIAE" && "border-success/20 bg-success/5 text-success",
                      t.role === "CR" && "border-muted bg-muted/50 text-muted-foreground"
                    )}>
                      {t.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground uppercase">{t.color_code}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => { setEditing(t); setShowCreate(false); }}
                            className="rounded-md p-2 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <div className="h-4 w-[1px] bg-border mx-1" />
                          <button
                            onClick={() => { if (confirm(`Permanently delete technology ${t.name}?`)) remove.mutate(t.slug); }}
                            disabled={remove.isPending}
                            className="rounded-md p-2 text-destructive/70 transition-all hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No technologies in your domain.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
