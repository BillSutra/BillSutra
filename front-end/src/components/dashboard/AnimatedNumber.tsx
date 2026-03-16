"use client";

import React from "react";
import { cn } from "@/lib/utils";

type AnimatedNumberProps = {
  value: number;
  format: (value: number) => string;
  durationMs?: number;
  className?: string;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const AnimatedNumber = ({
  value,
  format,
  durationMs = 800,
  className,
}: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = React.useState(value);
  const previousValueRef = React.useRef(value);

  React.useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayValue(value);
      previousValueRef.current = value;
      return;
    }

    const startValue = previousValueRef.current;
    const delta = value - startValue;
    if (!Number.isFinite(delta) || delta === 0) {
      setDisplayValue(value);
      previousValueRef.current = value;
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + delta * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        previousValueRef.current = value;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return <span className={cn("tabular-nums", className)}>{format(displayValue)}</span>;
};

export default AnimatedNumber;
