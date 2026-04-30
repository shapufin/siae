import { useState } from "react";
import { createPortal } from "react-dom";
import { Settings2, X } from "lucide-react";
import { useShiftMutations } from "../hooks/useShiftMutations";

interface Props {
  shift: { id: number; notes: string } | null;
  onClose: () => void;
}

export function EditShiftDialog({ shift, onClose }: Props) {
  const { editShift } = useShiftMutations();
  const [notes, setNotes] = useState(shift?.notes || "");
  if (!shift) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings2 className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold">Shift Notes</h4>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            editShift.mutate(
              { id: shift.id, notes },
              { onSuccess: onClose }
            );
          }}
          className="p-6 space-y-4"
        >
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Notes
            </label>
            <textarea
              className="flex min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Update shift details..."
            />
          </div>
          <button
            type="submit"
            disabled={editShift.isPending}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
          >
            {editShift.isPending ? "Saving..." : "Save Notes"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
