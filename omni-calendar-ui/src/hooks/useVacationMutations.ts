import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getApiErrorMessage, dateRange } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import type { Vacation } from "../types";

export interface VacationFormData {
  user_id: string;
  start_date: string;
  end_date: string;
  type: Vacation["type"];
  notes: string;
}

export function useVacationMutations() {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const create = useMutation({
    mutationFn: async (data: VacationFormData) => {
      const res = await api.post("/vacations/", {
        user_id: Number(data.user_id),
        start_date: data.start_date,
        end_date: data.end_date,
        type: data.type,
        notes: data.notes,
      });
      return res.data as Vacation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vacations.all });
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      showToast("Vacation created", "success");
    },
    onError: (err: unknown) => {
      showToast(getApiErrorMessage(err, "Failed to create vacation"), "error");
    },
  });

  const bulkCreate = useMutation({
    mutationFn: async (data: VacationFormData) => {
      const created: Vacation[] = [];
      for (const dateStr of dateRange(data.start_date, data.end_date)) {
        const res = await api.post("/vacations/", {
          user_id: Number(data.user_id),
          start_date: dateStr,
          end_date: dateStr,
          type: data.type,
          notes: data.notes,
        });
        created.push(res.data as Vacation);
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vacations.all });
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      showToast("Vacations created", "success");
    },
    onError: (err: unknown) => {
      showToast(getApiErrorMessage(err, "Failed to bulk create vacations"), "error");
    },
  });

  const update = useMutation({
    mutationFn: async (data: Vacation) => {
      const res = await api.patch(`/vacations/${data.id}/`, {
        start_date: data.start_date,
        end_date: data.end_date,
        type: data.type,
        notes: data.notes,
      });
      return res.data as Vacation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vacations.all });
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      showToast("Vacation updated", "success");
    },
    onError: (err: unknown) => {
      showToast(getApiErrorMessage(err, "Failed to update vacation"), "error");
    },
  });

  const deleteV = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/vacations/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vacations.all });
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all });
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
      showToast("Vacation deleted", "success");
    },
    onError: (err: unknown) => {
      showToast(getApiErrorMessage(err, "Failed to delete vacation"), "error");
    },
  });

  return {
    create,
    bulkCreate,
    update,
    deleteV,
    isPending: create.isPending || bulkCreate.isPending || update.isPending || deleteV.isPending,
  };
}
