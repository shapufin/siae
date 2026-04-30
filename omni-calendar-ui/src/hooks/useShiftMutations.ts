import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getApiErrorMessage } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";

export function useShiftMutations() {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const deleteShift = useMutation({
    mutationFn: (id: number) => api.delete(`/shifts/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      showToast("Shift deleted", "success");
    },
    onError: (err: unknown) =>
      showToast(getApiErrorMessage(err, "Failed to delete shift"), "error"),
  });

  const editShift = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const r = await api.patch(`/shifts/${id}/`, { notes });
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      showToast("Shift updated", "success");
    },
    onError: (err: unknown) =>
      showToast(getApiErrorMessage(err, "Failed to update shift"), "error"),
  });

  const editAssignment = useMutation({
    mutationFn: async (d: {
      id: number;
      type: "WORK_HOURS" | "STANDBY";
      user_id?: number;
      standby_detail_id?: number | null;
      standby_role?: "PRIMARY" | "BACKUP";
      standby_phone?: string;
    }) => {
      const payload: Record<string, unknown> = { type: d.type };
      if (d.user_id) payload.user_id = d.user_id;

      const r = await api.patch(`/assignments/${d.id}/`, payload);

      // Handle standby details: update existing OR create new if converting to STANDBY
      if (d.type === "STANDBY") {
        if (d.standby_detail_id) {
          // Update existing standby details
          await api.patch(`/standby-details/${d.standby_detail_id}/`, {
            role: d.standby_role || "PRIMARY",
            phone_number: d.standby_phone || "",
          });
        } else {
          // Create new standby details for this assignment
          await api.post("/standby-details/", {
            assignment: d.id,
            role: d.standby_role || "PRIMARY",
            phone_number: d.standby_phone || "",
          });
        }
      }
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      showToast("Assignment updated", "success");
    },
    onError: (err: unknown) => {
      showToast(
        getApiErrorMessage(err, "Failed to update assignment"),
        "error"
      );
    },
  });

  const swapStandbyRoles = useMutation({
    mutationFn: async ({ primaryId, backupId }: { primaryId: number; backupId: number }) => {
      await api.patch(`/standby-details/${primaryId}/`, { role: "BACKUP" });
      await api.patch(`/standby-details/${backupId}/`, { role: "PRIMARY" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      showToast("Standby roles swapped", "success");
    },
    onError: (err: unknown) =>
      showToast(getApiErrorMessage(err, "Failed to swap standby roles"), "error"),
  });

  return { deleteShift, editShift, editAssignment, swapStandbyRoles };
}
