"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { AVATAR_OPTIONS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  // Pick a deterministic "highlight" color per avatar so the grid feels alive.
  const [hovered, setHovered] = useState<string | null>(null);

  // Auto-select a random avatar if none provided
  useEffect(() => {
    if (!value) {
      onChange(AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)]);
    }
  }, [value, onChange]);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-muted-foreground">
        اختر شخصيتك
      </Label>
      <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
        {AVATAR_OPTIONS.map((a) => {
          const selected = value === a;
          const isHover = hovered === a;
          return (
            <button
              type="button"
              key={a}
              onClick={() => onChange(a)}
              onMouseEnter={() => setHovered(a)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "aspect-square rounded-xl text-2xl flex items-center justify-center transition-all",
                "border border-border/60 bg-secondary/40 hover:bg-secondary/80",
                "hover:scale-110 hover:-translate-y-0.5",
                selected &&
                  "border-primary border-2 bg-primary/15 scale-105 shadow-[0_0_20px_-2px_var(--primary)]",
                isHover && !selected && "border-primary/50",
              )}
              aria-label={`اختر ${a}`}
            >
              <span className="drop-shadow">{a}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
