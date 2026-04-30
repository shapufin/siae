import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { cn } from "../lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-secondary p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            theme === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={`Set ${opt.label} theme`}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
