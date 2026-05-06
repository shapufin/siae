import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Mail,
  Shield,
  Save,
  Send,
  Loader2,
  Lock,
  Database,
  AlertTriangle,
  Trash2,
  Download,
  Upload,
  X,
  Check,
  Megaphone,
} from "lucide-react";
import { api, useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { cn, getApiErrorMessage } from "../../lib/utils";
import { queryKeys } from "../../lib/queryKeys";

interface SettingsData {
  brand_name: string;
  client_role_label: string;
  consultant_role_label: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  smtp_from_email: string;
  notifications_enabled: boolean;
  notify_on_vacation_change: boolean;
  notify_on_shift_change: boolean;
  anon_throttle_rate: string;
  user_throttle_rate: string;
  jwt_access_minutes: number;
  jwt_refresh_days: number;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_color: "red" | "yellow" | "blue" | "green";
}

const DEFAULT_SETTINGS: SettingsData = {
  brand_name: "Omni Calendar",
  client_role_label: "Client",
  consultant_role_label: "Consultant",
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  smtp_use_tls: true,
  smtp_from_email: "noreply@omni-calendar.local",
  notifications_enabled: false,
  notify_on_vacation_change: true,
  notify_on_shift_change: true,
  anon_throttle_rate: "100/day",
  user_throttle_rate: "1000/hour",
  jwt_access_minutes: 60,
  jwt_refresh_days: 7,
  announcement_enabled: false,
  announcement_text: "",
  announcement_color: "red",
};

export function SettingsTab() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isSuperuser } = useAuth();

  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const res = await api.get("/settings/");
      return res.data;
    },
  });

  const [form, setForm] = useState<SettingsData>(DEFAULT_SETTINGS);

  // Sync form when data loads
  useState(() => {
    if (data) {
      setForm({ ...DEFAULT_SETTINGS, ...data, smtp_password: "" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<SettingsData>) => {
      const res = await api.put("/settings/", payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.all });
      qc.invalidateQueries({ queryKey: queryKeys.settings.public });
      showToast("Settings saved", "success");
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, "Failed to save settings"), "error");
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/settings/test-email/");
      return res.data;
    },
    onSuccess: () => {
      showToast("Test email sent", "success");
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, "Failed to send test email"), "error");
    },
  });

  const handleChange = <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Only send smtp_password if it's non-empty; empty string means "leave unchanged"
    const payload: Partial<SettingsData> = { ...form };
    if (!form.smtp_password) {
      delete payload.smtp_password;
    }
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Branding */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Branding</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">App Name</label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.brand_name}
              onChange={(e) => handleChange("brand_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Client Role Label</label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.client_role_label}
              onChange={(e) => handleChange("client_role_label", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Consultant Role Label</label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.consultant_role_label}
              onChange={(e) => handleChange("consultant_role_label", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* SMTP */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">SMTP Configuration</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">SMTP Host</label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.smtp_host}
              onChange={(e) => handleChange("smtp_host", e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">SMTP Port</label>
            <input
              type="number"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.smtp_port}
              onChange={(e) => handleChange("smtp_port", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">SMTP User</label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.smtp_user}
              onChange={(e) => handleChange("smtp_user", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">SMTP Password</label>
            <input
              type="password"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.smtp_password}
              onChange={(e) => handleChange("smtp_password", e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">From Email</label>
            <input
              type="email"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.smtp_from_email}
              onChange={(e) => handleChange("smtp_from_email", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input
              id="smtp-tls"
              type="checkbox"
              className="h-4 w-4 rounded border-primary"
              checked={form.smtp_use_tls}
              onChange={(e) => handleChange("smtp_use_tls", e.target.checked)}
            />
            <label htmlFor="smtp-tls" className="text-sm font-medium">
              Use TLS
            </label>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Notifications</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              id="notif-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-primary"
              checked={form.notifications_enabled}
              onChange={(e) => handleChange("notifications_enabled", e.target.checked)}
            />
            <label htmlFor="notif-enabled" className="text-sm font-medium">
              Enable email notifications
            </label>
          </div>
          <div className="flex items-center gap-3 pl-7">
            <input
              id="notif-vacation"
              type="checkbox"
              className="h-4 w-4 rounded border-primary"
              checked={form.notify_on_vacation_change}
              onChange={(e) => handleChange("notify_on_vacation_change", e.target.checked)}
              disabled={!form.notifications_enabled}
            />
            <label htmlFor="notif-vacation" className="text-sm font-medium">
              Notify on vacation changes
            </label>
          </div>
          <div className="flex items-center gap-3 pl-7">
            <input
              id="notif-shift"
              type="checkbox"
              className="h-4 w-4 rounded border-primary"
              checked={form.notify_on_shift_change}
              onChange={(e) => handleChange("notify_on_shift_change", e.target.checked)}
              disabled={!form.notifications_enabled}
            />
            <label htmlFor="notif-shift" className="text-sm font-medium">
              Notify on shift assignment changes
            </label>
          </div>
        </div>
      </section>

      {/* Announcement Banner */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Announcement Banner</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="announcement-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-primary"
              checked={form.announcement_enabled}
              onChange={(e) => handleChange("announcement_enabled", e.target.checked)}
            />
            <label htmlFor="announcement-enabled" className="text-sm font-medium">
              Enable banner visible on all pages
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Banner Text (HTML allowed)</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.announcement_text}
                onChange={(e) => handleChange("announcement_text", e.target.value)}
                placeholder="e.g. <strong>Important:</strong> System maintenance tonight."
                disabled={!form.announcement_enabled}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Banner Color</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.announcement_color}
                onChange={(e) => handleChange("announcement_color", e.target.value as any)}
                disabled={!form.announcement_enabled}
              >
                <option value="red">Red (Critical)</option>
                <option value="yellow">Yellow (Warning)</option>
                <option value="blue">Blue (Info)</option>
                <option value="green">Green (Success)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Security (superuser only) */}
      {isSuperuser && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Security</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Anon Throttle Rate
              </label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.anon_throttle_rate}
                onChange={(e) =>
                  handleChange("anon_throttle_rate", e.target.value)
                }
                placeholder="100/day"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                User Throttle Rate
              </label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.user_throttle_rate}
                onChange={(e) =>
                  handleChange("user_throttle_rate", e.target.value)
                }
                placeholder="1000/hour"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                JWT Access Lifetime (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.jwt_access_minutes}
                onChange={(e) =>
                  handleChange(
                    "jwt_access_minutes",
                    Math.min(1440, Math.max(1, Number(e.target.value)))
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                JWT Refresh Lifetime (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.jwt_refresh_days}
                onChange={(e) =>
                  handleChange(
                    "jwt_refresh_days",
                    Math.min(365, Math.max(1, Number(e.target.value)))
                  )
                }
              />
            </div>
          </div>
        </section>
      )}

      {/* Database Reset (superuser only) */}
      {isSuperuser && <DatabaseResetSection />}

      {/* Backup & Restore (superuser only) */}
      {isSuperuser && <BackupRestoreSection />}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
          )}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </button>
        <button
          type="button"
          onClick={() => testEmailMutation.mutate()}
          disabled={testEmailMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground shadow-sm hover:bg-secondary disabled:opacity-50"
          )}
        >
          {testEmailMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send Test Email
        </button>
      </div>
    </div>
  );
}

function DatabaseResetSection() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [checked, setChecked] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/admin/reset-db/", { confirm: "RESET_ALL_DATA" });
      return res.data;
    },
    onSuccess: (data) => {
      showToast(`Database reset complete. Preserved: ${data.preserved.superusers} superuser(s), ${data.preserved.technologies} tech(s).`, "success");
      qc.invalidateQueries();
      setIsExpanded(false);
      setConfirmText("");
      setChecked(false);
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, "Database reset failed"), "error");
    },
  });

  const canReset = checked && confirmText === "RESET_ALL_DATA";

  return (
    <section className="space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-6">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-destructive" />
        <h3 className="text-lg font-semibold text-destructive">Database Reset</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Erase all shifts, assignments, vacations, and non-admin users. Technologies and site settings are preserved.
      </p>

      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive hover:text-white transition-colors"
        >
          <AlertTriangle className="h-4 w-4" />
          Initialize Reset
        </button>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-lg border border-destructive/20 bg-background p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">This action cannot be undone.</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                  <li>All shifts and assignments will be permanently deleted</li>
                  <li>All vacation records will be permanently deleted</li>
                  <li>All non-superuser accounts will be permanently deleted</li>
                  <li>Technologies and site settings will be preserved</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-destructive">
                Type <code className="bg-destructive/10 px-1 py-0.5 rounded text-[10px]">RESET_ALL_DATA</code> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET_ALL_DATA"
                className="flex h-10 w-full rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-mono text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="reset-ack"
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="h-4 w-4 rounded border-destructive text-destructive focus:ring-destructive"
              />
              <label htmlFor="reset-ack" className="text-xs font-medium text-destructive cursor-pointer">
                I understand this will permanently erase all operational data.
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setConfirmText("");
                setChecked(false);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("FINAL WARNING: This is irreversible. Proceed?")) {
                  resetMutation.mutate();
                }
              }}
              disabled={!canReset || resetMutation.isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all",
                canReset
                  ? "bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20"
                  : "bg-destructive/40 cursor-not-allowed"
              )}
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Reset Database
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function BackupRestoreSection() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [isRestoreExpanded, setIsRestoreExpanded] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreChecked, setRestoreChecked] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backupMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get("/admin/backup/");
      return res.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omni-calendar-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Backup downloaded successfully", "success");
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, "Backup failed"), "error");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("/admin/restore/", { confirm: "RESTORE_FROM_BACKUP", payload });
      return res.data;
    },
    onSuccess: (data) => {
      showToast(`Restore complete: ${data.restored.shifts} shifts, ${data.restored.users} users, ${data.restored.vacations} vacations.`, "success");
      qc.invalidateQueries();
      setIsRestoreExpanded(false);
      setRestoreConfirm("");
      setRestoreChecked(false);
      setSelectedFile(null);
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, "Restore failed"), "error");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRestore = () => {
    if (!selectedFile) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.version !== "1.0") {
          showToast("Invalid backup file version", "error");
          return;
        }
        restoreMutation.mutate(json);
      } catch {
        showToast("Invalid JSON backup file", "error");
      }
    };
    reader.readAsText(selectedFile);
  };

  const canRestore = restoreChecked && restoreConfirm === "RESTORE_FROM_BACKUP" && !!selectedFile;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Data Management</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Export a complete snapshot of your database or restore from a previous backup.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => backupMutation.mutate()}
          disabled={backupMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold text-foreground shadow-sm hover:bg-secondary transition-colors disabled:opacity-50"
          )}
        >
          {backupMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download Backup
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRestoreExpanded(!isRestoreExpanded);
            setRestoreConfirm("");
            setRestoreChecked(false);
            setSelectedFile(null);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-colors",
            isRestoreExpanded 
              ? "border-secondary bg-secondary text-secondary-foreground" 
              : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
          )}
        >
          {isRestoreExpanded ? <X className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {isRestoreExpanded ? "Cancel Restore" : "Restore from Backup"}
        </button>
      </div>

      {isRestoreExpanded && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-lg border border-destructive/20 bg-background p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">This will overwrite all current data.</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                  <li>All current shifts, assignments, and vacations will be deleted</li>
                  <li>All non-superuser accounts will be replaced with backup data</li>
                  <li>Technologies and site settings will be updated to match the backup</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-destructive">
                1. Select backup JSON file
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:text-primary-foreground hover:file:bg-primary/90"
              />
              {selectedFile && (
                <p className="text-[10px] font-medium text-success flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Ready to restore: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-destructive">
                2. Type <code className="bg-destructive/10 px-1 py-0.5 rounded text-[10px]">RESTORE_FROM_BACKUP</code> to confirm
              </label>
              <input
                type="text"
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                placeholder="RESTORE_FROM_BACKUP"
                className="flex h-10 w-full rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-mono text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="restore-ack"
                type="checkbox"
                checked={restoreChecked}
                onChange={(e) => setRestoreChecked(e.target.checked)}
                className="h-4 w-4 rounded border-destructive text-destructive focus:ring-destructive"
              />
              <label htmlFor="restore-ack" className="text-xs font-medium text-destructive cursor-pointer">
                3. I understand this will overwrite all current operational data.
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRestore}
              disabled={!canRestore || restoreMutation.isPending}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition-all",
                canRestore
                  ? "bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20"
                  : "bg-destructive/40 cursor-not-allowed"
              )}
            >
              {restoreMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Start System Restore
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
