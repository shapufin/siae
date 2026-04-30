import { format, parseISO } from "date-fns";
import { Trash2, Pencil } from "lucide-react";
import { getDisplayName } from "../lib/utils";
import type { Vacation } from "../types";

interface VacationCardGroupProps {
  groupedVacations: Record<number, { user: Vacation["user"]; vacations: Vacation[] }>;
  canDelete: (v: Vacation) => boolean;
  canEdit: (v: Vacation) => boolean;
  onEdit: (v: Vacation) => void;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
}

export function VacationCardGroup({
  groupedVacations,
  canDelete,
  canEdit,
  onEdit,
  onDelete,
  isDeleting,
}: VacationCardGroupProps) {
  return (
    <div className="space-y-4">
      {Object.values(groupedVacations).map(({ user: u, vacations: userVacations }) => (
        <div key={u.id} className="rounded-lg border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-2">
            <p className="text-sm font-medium">{getDisplayName(u)}</p>
          </div>
          <div className="divide-y divide-border">
            {userVacations.map((vacation) => (
              <div
                key={vacation.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {format(parseISO(vacation.start_date), "dd MMMM yyyy")} -{" "}
                      {format(parseISO(vacation.end_date), "dd MMMM yyyy")}
                    </p>
                    {vacation.type && (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                        {vacation.type}
                      </span>
                    )}
                  </div>
                  {vacation.notes && (
                    <p className="text-sm text-muted-foreground">{vacation.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {canEdit(vacation) && (
                    <button
                      onClick={() => onEdit(vacation)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
                      title="Edit vacation"
                      aria-label="Edit vacation"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete(vacation) && (
                    <button
                      onClick={() => {
                        if (confirm("Delete this vacation?")) {
                          onDelete(vacation.id);
                        }
                      }}
                      disabled={isDeleting}
                      className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      title="Delete vacation"
                      aria-label="Delete vacation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
