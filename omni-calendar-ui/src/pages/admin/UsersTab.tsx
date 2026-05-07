import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, X, Shield, ShieldCheck, UserPlus, Settings2, Check, Users, Zap, ZapOff, KeyRound, RefreshCw, Eye, EyeOff, Loader2 } from "lucide-react";
import { api, useAuth } from "../../contexts/AuthContext";
import { useSiteSettings } from "../../contexts/SiteSettingsContext";
import { useToast } from "../../contexts/ToastContext";
import { cn, getDisplayName, getApiErrorMessage, unwrapResults } from "../../lib/utils";
import { queryKeys } from "../../lib/queryKeys";
import { DEFAULT_PAGE_SIZE } from "../../lib/constants";
import type { User, Technology } from "../../types";

export function UsersTab() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isAdmin, isManager, user } = useAuth();
  const { client_role_label, consultant_role_label } = useSiteSettings();
  const canManage = isAdmin || isManager;
  const managerRole = user?.role as "CR" | "SIAE" | "ENG" | undefined;
  const defaultRole = isAdmin ? "CR" : (managerRole || "CR");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resettingPasswordFor, setResettingPasswordFor] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [newU, setNewU] = useState({ username: "", email: "", password: "", first_name: "", last_name: "", phone_number: "", role: defaultRole });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTechId, setBulkTechId] = useState("");
  const [bulkSetDefault, setBulkSetDefault] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const generateSecurePassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    // Ensure at least one of each required type to satisfy backend regex
    retVal += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    retVal += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    retVal += "0123456789"[Math.floor(Math.random() * 10)];
    retVal += "!@#$%^&*()_+"[Math.floor(Math.random() * 12)];
    
    for (let i = 0, n = charset.length; i < length - 4; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    // Shuffle the result
    return retVal.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const { data: rawUsers, isLoading } = useQuery<User[]>({ queryKey: queryKeys.users.all, queryFn: async () => unwrapResults(await api.get<User[]>(`/users/?page_size=${DEFAULT_PAGE_SIZE}`)) });
  const { data: techs } = useQuery<Technology[]>({ queryKey: queryKeys.technologies.all, queryFn: async () => unwrapResults(await api.get<Technology[]>("/technologies/")) });

  // Filter users based on Manager domain
  const { isSuperuser } = useAuth();
  const users = rawUsers?.filter(u => isAdmin || isSuperuser || (isManager && u.role === user?.role));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const selectAll = () => {
    if (users && users.length > 0) {
      setSelectedIds(users.map((u) => u.id));
    }
  };
  const clearSelection = () => setSelectedIds([]);
  const isAllSelected = users && users.length > 0 && selectedIds.length === users.length;

  const createU = useMutation({
    mutationFn: (d: typeof newU) => api.post("/users/", d).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      setShowCreate(false);
      setNewU({ username: "", email: "", password: "", first_name: "", last_name: "", phone_number: "", role: defaultRole });
      showToast("User created successfully", "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to create user"), "error"),
  });

  const deleteU = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); showToast("User deleted", "success"); },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to delete user"), "error"),
  });

  const updateU = useMutation({
    mutationFn: (d: { id: number } & Omit<Partial<User>, "technologies"> & { is_manager?: boolean; technologies?: { technology_id: number; is_default: boolean }[] }) =>
      api.patch(`/users/${d.id}/`, d).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      setEditing(null);
      showToast("User updated successfully", "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to update user"), "error"),
  });

  const bulkAssignTech = useMutation({
    mutationFn: async ({ userIds, techId, isDefault }: { userIds: number[]; techId: number; isDefault: boolean }) => {
      for (const uid of userIds) {
        const u = users?.find((x) => x.id === uid);
        if (!u) continue;
        const currentTechs = u.technologies?.map((t) => ({ technology_id: t.technology.id, is_default: t.is_default })) || [];
        const existing = currentTechs.find((t) => t.technology_id === techId);
        let newTechs;
        if (existing) {
          newTechs = currentTechs.map((t) => (t.technology_id === techId ? { ...t, is_default: isDefault } : t));
        } else {
          newTechs = [...currentTechs, { technology_id: techId, is_default: isDefault }];
        }
        await api.patch(`/users/${uid}/`, { technologies: newTechs });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      clearSelection();
      setBulkTechId("");
      setBulkSetDefault(false);
      showToast("Technology assigned to selected users", "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to bulk assign technology"), "error"),
  });

  const bulkSetActive = useMutation({
    mutationFn: async ({ userIds, isActive }: { userIds: number[]; isActive: boolean }) => {
      for (const uid of userIds) {
        await api.patch(`/users/${uid}/`, { is_active: isActive });
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      clearSelection();
      showToast(vars.isActive ? "Selected users activated" : "Selected users deactivated", "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to update users"), "error"),
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      api.post(`/users/${userId}/set-password/`, { new_password: newPassword }).then((r) => r.data),
    onSuccess: (_, vars) => {
      setResettingPasswordFor(null);
      setResetPasswordValue("");
      showToast(`Password reset for user #${vars.userId}`, "success");
    },
    onError: (err) => showToast(getApiErrorMessage(err, "Failed to reset password"), "error"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight">User Management</h3>
          <p className="text-sm text-muted-foreground">Manage platform users, roles, and system access.</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowCreate(!showCreate); setEditing(null); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
          >
            {showCreate ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showCreate ? "Cancel" : "Add New User"}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-in fade-in slide-in-from-top-2">
          <h4 className="mb-6 flex items-center gap-2 text-base font-semibold">
            <UserPlus className="h-5 w-5 text-primary" />
            Create New Account
          </h4>
          <form onSubmit={(e) => { e.preventDefault(); createU.mutate(newU); }} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Username</label>
                <input
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newU.username}
                  onChange={(e) => setNewU({ ...newU, username: e.target.value })}
                  placeholder="jdoe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Email Address</label>
                <input
                  type="email"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newU.email}
                  onChange={(e) => setNewU({ ...newU, email: e.target.value })}
                  placeholder="john.doe@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">First Name</label>
                <input
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newU.first_name}
                  onChange={(e) => setNewU({ ...newU, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Last Name</label>
                <input
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newU.last_name}
                  onChange={(e) => setNewU({ ...newU, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Phone Number</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newU.phone_number}
                  onChange={(e) => setNewU({ ...newU, phone_number: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">System Role</label>
                <select
                  disabled={!isAdmin}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70"
                  value={newU.role}
                  onChange={(e) => setNewU({ ...newU, role: e.target.value as "ENG" | "SIAE" | "CR" })}
                >
                  <option value="ENG">{consultant_role_label} (ENG)</option>
                  <option value="SIAE">{client_role_label} (SIAE)</option>
                  <option value="CR">Read-Only (CR)</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none">Password</label>
                  <button
                    type="button"
                    title="Generate secure password"
                    onClick={() => {
                      const pass = generateSecurePassword();
                      setNewU({ ...newU, password: pass });
                      setShowPassword(true);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-primary hover:underline"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm"
                    value={newU.password}
                    onChange={(e) => setNewU({ ...newU, password: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createU.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createU.isPending ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <UserEditSheet
          user={editing}
          techs={techs || []}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            updateU.mutate({ id: editing.id, ...data });
          }}
          isPending={updateU.isPending}
        />
      )}

      {resettingPasswordFor && (
        <PasswordResetDialog
          user={resettingPasswordFor}
          password={resetPasswordValue}
          onPasswordChange={setResetPasswordValue}
          onClose={() => { setResettingPasswordFor(null); setResetPasswordValue(""); }}
          onConfirm={() => {
            if (resetPasswordValue.length >= 8) {
              resetPassword.mutate({ userId: resettingPasswordFor.id, newPassword: resetPasswordValue });
            }
          }}
          isPending={resetPassword.isPending}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Users className="h-4 w-4" />
            {selectedIds.length} users selected
          </div>
          <div className="h-4 w-px bg-primary/20 hidden sm:block" />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={bulkTechId}
              onChange={(e) => setBulkTechId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="">Assign Technology...</option>
              {techs?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
              <input type="checkbox" checked={bulkSetDefault} onChange={(e) => setBulkSetDefault(e.target.checked)} className="h-3.5 w-3.5 rounded border-primary" />
              Set as Default
            </label>
            <button
              disabled={!bulkTechId || bulkAssignTech.isPending}
              onClick={() => bulkAssignTech.mutate({ userIds: selectedIds, techId: Number(bulkTechId), isDefault: bulkSetDefault })}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {bulkAssignTech.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {bulkAssignTech.isPending ? "Assigning..." : "Apply Tech"}
            </button>
          </div>
          <div className="h-4 w-px bg-primary/20 hidden sm:block" />
          <div className="flex items-center gap-2">
            <button
              disabled={bulkSetActive.isPending}
              onClick={() => bulkSetActive.mutate({ userIds: selectedIds, isActive: true })}
              className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-bold text-success hover:bg-success/20 disabled:opacity-50"
            >
              {bulkSetActive.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <Zap className="h-3 w-3" /> {bulkSetActive.isPending ? "Activating..." : "Activate"}
            </button>
            <button
              disabled={bulkSetActive.isPending}
              onClick={() => bulkSetActive.mutate({ userIds: selectedIds, isActive: false })}
              className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {bulkSetActive.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <ZapOff className="h-3 w-3" /> {bulkSetActive.isPending ? "Deactivating..." : "Deactivate"}
            </button>
          </div>
          <button onClick={clearSelection} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">Clear selection</button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-primary cursor-pointer"
                    checked={isAllSelected}
                    onChange={() => isAllSelected ? clearSelection() : selectAll()}
                    aria-label="Select all users"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Identity</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Default Tech</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Access Level</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Activity</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground"><div className="flex justify-center items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />Loading directory...</div></td></tr>
              ) : users?.length ? (
                users.map((u) => (
                  <tr key={u.id} className={cn("transition-colors hover:bg-muted/50", !u.is_active && "bg-muted/10", selectedIds.includes(u.id) && "bg-primary/5")}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-primary cursor-pointer"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        aria-label={`Select user ${u.username}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold uppercase text-secondary-foreground">
                          {u.first_name?.[0] || u.username[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{getDisplayName(u)}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">{u.email}</span>
                            <span className="text-[10px] bg-secondary/50 px-1 rounded font-bold text-muted-foreground" title="Username">@{u.username}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium shadow-sm",
                        u.role === "ENG" && "border-info/20 bg-info/5 text-info dark:border-info/80 dark:bg-info/30 dark:text-info-foreground",
                        u.role === "SIAE" && "border-success/20 bg-success/5 text-success dark:border-success/80 dark:bg-success/30 dark:text-success-foreground",
                        u.role === "CR" && "border-muted bg-muted/50 text-muted-foreground"
                      )}>
                        {u.role === "ENG" ? consultant_role_label : u.role === "SIAE" ? client_role_label : u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full", u.is_active ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-destructive")} />
                        <span className="text-xs font-medium">{u.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const defaultTech = u.technologies?.find(t => t.is_default)?.technology;
                        if (!defaultTech) return <span className="text-xs text-muted-foreground">None</span>;
                        return (
                          <span
                            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                            style={{
                              borderColor: `${defaultTech.color_code}40`,
                              backgroundColor: `${defaultTech.color_code}15`,
                              color: defaultTech.color_code
                            }}
                          >
                            {defaultTech.name}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.permissions?.is_admin && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                            <ShieldCheck className="h-3 w-3" />Admin
                          </span>
                        )}
                        {u.permissions?.is_manager && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-500">
                            <Shield className="h-3 w-3" />Manager
                          </span>
                        )}
                        {!u.permissions?.is_admin && !u.permissions?.is_manager && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Standard</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Joined {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : "Unknown"}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Last: {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <button
                            onClick={() => setEditing(u)}
                            className="rounded-md p-2 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                            title="Edit User"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                        )}
                        {(isSuperuser || isManager || (user?.id === u.id)) && (
                          <button
                            onClick={() => setResettingPasswordFor(u)}
                            className="rounded-md p-2 text-muted-foreground transition-all hover:bg-amber-500/10 hover:text-amber-600"
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => { if (confirm(`Permanently delete user ${u.username}?`)) deleteU.mutate(u.id); }}
                            disabled={deleteU.isPending}
                            className="rounded-md p-2 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No users matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface UserEditFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_manager: boolean;
  role: "CR" | "SIAE" | "ENG";
  technologies: { technology_id: number; is_default: boolean }[];
}

interface UserEditSheetProps {
  user: User;
  techs: Technology[];
  onClose: () => void;
  onSave: (data: UserEditFormData) => void;
  isPending: boolean;
}

function UserEditSheet({ user, techs, onClose, onSave, isPending }: UserEditSheetProps) {
  const { isAdmin } = useAuth();
  const { client_role_label, consultant_role_label } = useSiteSettings();
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    phone_number: user.phone_number || "",
    is_active: user.is_active ?? true,
    is_staff: user.is_staff || false,
    is_superuser: user.is_superuser || false,
    is_manager: user.permissions?.is_manager || false,
    role: user.role,
    technologies: user.technologies?.map(ut => ({ technology_id: ut.technology.id, is_default: ut.is_default })) || []
  });

  const toggleTech = (tid: number) => {
    const exists = form.technologies.find(t => t.technology_id === tid);
    if (exists) {
      setForm({ ...form, technologies: form.technologies.filter(t => t.technology_id !== tid) });
    } else {
      setForm({ ...form, technologies: [...form.technologies, { technology_id: tid, is_default: false }] });
    }
  };

  const setDefaultTech = (tid: number) => {
    setForm({
      ...form,
      technologies: form.technologies.map(t => ({
        ...t,
        is_default: t.technology_id === tid
      }))
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-none">Edit Profile</h3>
              <p className="mt-1 text-sm text-muted-foreground font-mono">ID: {user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</label>
              <input
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</label>
              <input
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
              <input
                required
                type="email"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
              <input
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role Hierarchy</label>
              <select
                disabled={!isAdmin}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "ENG" | "SIAE" | "CR" })}
              >
                <option value="ENG">{consultant_role_label} (ENG)</option>
                <option value="SIAE">{client_role_label} (SIAE)</option>
                <option value="CR">Read-Only (CR)</option>
              </select>
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground italic">Only administrators can change role assignments.</p>
              )}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {isAdmin && (
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">System Permissions</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                    form.is_active ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                  )}>
                    <input type="checkbox" className="h-4 w-4 rounded border-primary" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    <div>
                      <div className="text-sm font-semibold">Active Account</div>
                      <div className="text-[10px] text-muted-foreground">Allow system login and assignment</div>
                    </div>
                  </label>
                  <label className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                    form.is_staff ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                  )}>
                    <input type="checkbox" className="h-4 w-4 rounded border-primary" checked={form.is_staff} onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} />
                    <div>
                      <div className="text-sm font-semibold">Admin Access</div>
                      <div className="text-[10px] text-muted-foreground">Full administrative dashboard access</div>
                    </div>
                  </label>
                  <label className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                    form.is_manager ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                  )}>
                    <input type="checkbox" className="h-4 w-4 rounded border-primary" checked={form.is_manager} onChange={(e) => setForm({ ...form, is_manager: e.target.checked })} />
                    <div>
                      <div className="text-sm font-semibold">Manager Role</div>
                      <div className="text-[10px] text-muted-foreground">Department-level management rights</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Technological Proficiencies</label>
              <div className="flex flex-wrap gap-2">
                {techs.map((t) => {
                  const techSetting = form.technologies.find(ut => ut.technology_id === t.id);
                  const isSelected = !!techSetting;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all",
                        isSelected ? "border-primary/30 bg-primary/10" : "border-border bg-background"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTech(t.id)}
                        className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-muted-foreground")}
                      >
                        {t.name}
                      </button>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => setDefaultTech(t.id)}
                          className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center",
                            techSetting.is_default ? "bg-primary border-primary text-white" : "border-primary/30 text-primary/30"
                          )}
                          title={techSetting.is_default ? "Default Tech" : "Set as Default"}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input bg-background px-6 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-8 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Syncing..." : "Commit Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PasswordResetDialogProps {
  user: User;
  password: string;
  onPasswordChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function PasswordResetDialog({ user, password, onPasswordChange, onClose, onConfirm, isPending }: PasswordResetDialogProps) {
  const [showPassword, setShowPassword] = useState(false);

  const generateSecurePassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    // Ensure at least one of each required type to satisfy backend regex
    retVal += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    retVal += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    retVal += "0123456789"[Math.floor(Math.random() * 10)];
    retVal += "!@#$%^&*()_+"[Math.floor(Math.random() * 12)];

    for (let i = 0, n = charset.length; i < length - 4; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    // Shuffle the result
    return retVal.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const canConfirm = password.length >= 8;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-none">Reset Password</h3>
              <p className="mt-1 text-sm text-muted-foreground font-mono">{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password</label>
              <button
                type="button"
                title="Generate secure password"
                onClick={() => {
                  const pass = generateSecurePassword();
                  onPasswordChange(pass);
                  setShowPassword(true);
                }}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-primary hover:underline"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Generate
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && password.length < 8 && (
              <p className="text-xs text-destructive">Password must be at least 8 characters.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-input bg-background px-6 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || isPending}
              className="rounded-lg bg-primary px-8 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}