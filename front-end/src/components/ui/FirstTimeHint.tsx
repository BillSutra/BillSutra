"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasSeenHint, markHintSeen } from "@/lib/firstRun";

type FirstTimeHintProps = {
  id: string;
  message: string;
  children: React.ReactNode;
  className?: string;
  bubbleClassName?: string;
  position?: "top" | "bottom";
};

const positionClassName: Record<NonNullable<FirstTimeHintProps["position"]>, string> = {
  top: "bottom-[calc(100%+0.75rem)] left-0",
  bottom: "top-[calc(100%+0.75rem)] left-0",
};

const FirstTimeHint = ({
  id,
  message,
  children,
  className,
  bubbleClassName,
  position = "top",
}: FirstTimeHintProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasSeenHint(id)) return;

    const openTimer = window.setTimeout(() => {
      setVisible(true);
    }, 450);
    const closeTimer = window.setTimeout(() => {
      markHintSeen(id);
      setVisible(false);
    }, 6800);

    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, [id]);

  const dismiss = () => {
    markHintSeen(id);
    setVisible(false);
  };

  return (
    <div className={cn("relative", className)}>
      {children}
      {visible ? (
        <div
          className={cn(
            "pointer-events-auto absolute z-20 max-w-xs rounded-2xl border border-amber-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.28)] dark:border-amber-900/40 dark:bg-slate-950 dark:text-slate-200",
            positionClassName[position],
            bubbleClassName,
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
              <Lightbulb size={14} />
            </div>
            <div className="min-w-0 flex-1 pr-5 leading-5">{message}</div>
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-2.5 right-2.5 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Dismiss hint"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FirstTimeHint;
