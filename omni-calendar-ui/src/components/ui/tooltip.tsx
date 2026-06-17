import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ children, content, side = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();

      let left = rect.left + rect.width / 2;
      let top = rect.top;

      if (side === "top") top -= 8;
      else if (side === "bottom") top += rect.height + 8;
      else if (side === "left") left = rect.left - 8;
      else if (side === "right") left = rect.right + 8;

      setPos({ left, top });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, side]);

  const tooltipContent = (
    <div
      className={cn(
        "fixed z-[9999] pointer-events-none",
        side === "top" && "-translate-x-1/2 -translate-y-full",
        side === "bottom" && "-translate-x-1/2",
        side === "left" && "-translate-x-full -translate-y-1/2",
        side === "right" && "-translate-y-1/2"
      )}
      style={{ left: pos.left, top: pos.top }}
    >
      <div
        className={cn(
          "rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white shadow-xl",
          "border border-zinc-700/50",
          "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
          className
        )}
      >
        {content}
      </div>
      <div
        className={cn(
          "absolute w-2 h-2 rotate-45 bg-zinc-900",
          side === "top" && "left-1/2 -bottom-1 -translate-x-1/2 border-r border-b border-zinc-700/50",
          side === "bottom" && "left-1/2 -top-1 -translate-x-1/2 border-l border-t border-zinc-700/50",
          side === "left" && "right-[-3px] top-1/2 -translate-y-1/2 border-t border-r border-zinc-700/50",
          side === "right" && "left-[-3px] top-1/2 -translate-y-1/2 border-b border-l border-zinc-700/50"
        )}
      />
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex flex-1"
      >
        {children}
      </div>
      {open && createPortal(tooltipContent, document.body)}
    </>
  );
}
