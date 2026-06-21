"use client";

import { LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "./logo";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  user: Profile | null;
  onLogout: () => void;
  onLogoClick?: () => void;
}

export function Header({ user, onLogout, onLogoClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <button
          onClick={onLogoClick}
          className="transition-transform hover:scale-[1.02]"
        >
          <Logo size="sm" />
        </button>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 py-1 pl-3 pr-1 transition-colors hover:bg-secondary/80">
                <span className="text-sm font-medium hidden sm:inline">
                  {user.username}
                </span>
                <Avatar className="h-8 w-8 border border-border/60">
                  <AvatarFallback className="bg-primary/15 text-lg">
                    {user.avatar}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2">
                <span className="text-xl">{user.avatar}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.username}</span>
                  <span className="text-xs text-muted-foreground">
                    حسابك
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="ml-2 h-4 w-4" />
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">حساب مجهول</span>
          </div>
        )}
      </div>
    </header>
  );
}
