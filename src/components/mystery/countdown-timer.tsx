"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  /** Duration in seconds */
  duration: number;
  /** Optional start-at timestamp (ms) so clients stay in sync */
  startedAt?: number;
  /** Callback when timer reaches zero */
  onComplete?: () => void;
  className?: string;
  /** Variant */
  variant?: "default" | "compact" | "large";
}

export function CountdownTimer({
  duration,
  startedAt,
  onComplete,
  className,
  variant = "default",
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const completedRef = useRef(false);

  useEffect(() => {
    const start = startedAt ?? Date.now();
    completedRef.current = false;

    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const rem = Math.max(0, duration - elapsed);
      setRemaining(rem);
      if (rem <= 0 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [duration, startedAt, onComplete]);

  const totalSec = Math.ceil(remaining);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const display = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const pct = (remaining / duration) * 100;
  const urgent = remaining < 10;

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "font-mono tabular-nums",
          urgent && "text-destructive animate-pulse",
          className,
        )}
      >
        {display}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "relative font-mono tabular-nums tracking-tight",
          variant === "large" ? "text-5xl sm:text-7xl" : "text-3xl",
          urgent ? "text-destructive animate-pulse" : "text-foreground",
        )}
      >
        {display}
      </div>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            urgent
              ? "bg-destructive"
              : "bg-gradient-to-r from-primary via-fuchsia-400 to-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
