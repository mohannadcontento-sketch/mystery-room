"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  const iconSize =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const textSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative rounded-2xl bg-gradient-to-br from-primary via-fuchsia-500 to-primary flex items-center justify-center",
          iconSize,
          "shadow-[0_0_25px_-5px_var(--primary)]",
        )}
      >
        <Sparkles className="h-1/2 w-1/2 text-primary-foreground" />
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-md -z-10" />
      </div>
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight bg-gradient-to-r from-foreground via-fuchsia-200 to-foreground bg-clip-text text-transparent",
            textSize,
          )}
        >
          Mystery Room
        </span>
      )}
    </div>
  );
}
