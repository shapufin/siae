import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, Table2 } from "lucide-react";
import { api, useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage, getDisplayName, unwrapResults } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import { useVacationMutations } from "../hooks/useVacationMutations";
import { VacationFormFields } from "../components/VacationFormFields";
import { VacationCardGroup } from "../components/VacationCardGroup";
import { MAX_NOTES_LENGTH } from "../lib/constants";
import type { Vacation, User } from "../types";

export function VacationHub() {
  const { user, isAdmin, isManager } = useAuth();
  const isAdminOrManager = isAdmin || isManager;
  const [form, setForm] = useState({ user_id: "", start_date: "", end_date: "", type: "PTO" as Vacation["type"], notes: "" });
  const [editing, setEditing] = useState<Vacation | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");

  const { create, update, deleteV } = useVacationMutations();

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => unwrapResults(await api.get<User[]>("/users/")),
    enabled: isAdminOrManager,
  });

  const { data: vacations, isLoading, isError, error, refetch } = useQuery<Vacation[]>({
    queryKey: [...queryKeys.vacations.all, "shared"],
    queryFn: async () => unwrapResults(await api.get<Vacation[]>("/vacations/?all=true")),
    staleTime: 0,
  });

  const canManage = (v: Vacation) => isAdmin || (isManager && v.user.role === user?.role) || v.user.id === user?.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const uid = form.user_id ? Number(form.user_id) : user?.id;
    if (!uid || !form.start_date || !form.end_date) return;
    create.mutate({ ...form, user_id: String(uid) });
    setForm({ user_id: "", start_date: "", end_date: "", type: "PTO", notes: "" });
  };

  const groupedVacations = vacations?.reduce((acc, vacation) => {
    const key = vacation.user.id;
    if (!acc[key]) acc[key] = { user: vacation.user, vacations: [] };
    acc[key].vacations.push(vacation);
    return acc;
  }, {} as Record<number, { user: Vacation["user"]; vacations: Vacation[] }>);

  return (
    <div className="mx-auto max-w-2xl w-full px-4 space-y-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Vacation Hub</h2>
      </div>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(editing); setEditing(null); }} className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Edit Vacation</h3>
            <button type="button" onClick={() => setEditing(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
          <VacationFormFields
            value={{ user_id: String(editing.user.id), start_date: editing.start_date, end_date: editing.end_date, type: editing.type || "PTO", notes: editing.notes }}
            onChange={(next) => setEditing({ ...editing, start_date: next.start_date, end_date: next.end_date, type: next.type, notes: next.notes })}
            users={users}
            isAdmin={isAdmin}
            currentRole={user?.role}
            showUserSelect={isAdminOrManager}
          />
          <button type="submit" disabled={update.isPending || (editing?.notes || "").length > MAX_NOTES_LENGTH} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {update.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-4">
            <VacationFormFields
              value={form}
              onChange={setForm}
              users={users}
              isAdmin={isAdmin}
              currentRole={user?.role}
              showUserSelect={isAdminOrManager}
              currentUserName={user?.username}
            />
            <button type="submit" disabled={create.isPending || form.notes.length > MAX_NOTES_LENGTH} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {create.isPending ? "Submitting..." : "Add Vacation"}
            </button>
          </form>
        </>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{isAdminOrManager ? "All Vacations" : "Your Vacations"}</h3>
          {isAdminOrManager && (
            <div className="flex items-center gap-1 rounded-md border border-border p-1">
              <button onClick={() => setView("cards")} className={`rounded p-1 ${view === "cards" ? "bg-secondary" : ""}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => setView("table")} className={`rounded p-1 ${view === "table" ? "bg-secondary" : ""}`} title="Table view"><Table2 className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : isError ? (
          <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="text-destructive">Unable to load vacations: {getApiErrorMessage(error, "The server request failed.")}</p>
            <button type="button" onClick={() => refetch()} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
              Try again
            </button>
          </div>
        ) : view === "cards" && groupedVacations && Object.keys(groupedVacations).length > 0 ? (
          <VacationCardGroup
            groupedVacations={groupedVacations}
            canDelete={canManage}
            canEdit={canManage}
            onEdit={setEditing}
            onDelete={(id) => deleteV.mutate(id)}
            isDeleting={deleteV.isPending}
          />
        ) : view === "table" && vacations && vacations.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-4 py-3 text-left font-medium">User</th><th className="px-4 py-3 text-left font-medium">Start</th><th className="px-4 py-3 text-left font-medium">End</th><th className="px-4 py-3 text-left font-medium">Type</th><th className="px-4 py-3 text-left font-medium">Notes</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
              <tbody>
                {vacations.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{getDisplayName(v.user)}</td>
                    <td className="px-4 py-3">{v.start_date}</td>
                    <td className="px-4 py-3">{v.end_date}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{v.type || "PTO"}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{v.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {canManage(v) && (
                        <>
                          <button onClick={() => setEditing(v)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary mr-1" title="Edit">Edit</button>
                          <button onClick={() => { if (confirm("Delete this vacation?")) deleteV.mutate(v.id); }} disabled={deleteV.isPending} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50" title="Delete">Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No vacations recorded.</p>
        )}
      </div>
    </div>
  );
}
