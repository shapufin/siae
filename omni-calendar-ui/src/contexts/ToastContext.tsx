import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    const timerId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(timerId);
    }, 4000);
    timersRef.current.add(timerId);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "rounded-lg border px-4 py-3 shadow-lg transition-all",
              toast.type === "success" &&
                "border-success/20 bg-success/10 text-success dark:border-success/80 dark:bg-success/30 dark:text-success-foreground",
              toast.type === "error" &&
                "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/80 dark:bg-destructive/30 dark:text-destructive-foreground",
              toast.type === "info" && "border-info/20 bg-info/5 text-info dark:border-info/80 dark:bg-info/30 dark:text-info-foreground"
            )}
            role="alert"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="ml-2 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Dismiss notification"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
