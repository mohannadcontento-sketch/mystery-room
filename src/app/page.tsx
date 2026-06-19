"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/mystery/header";
import { AuthScreen } from "@/components/mystery/auth-screen";
import { HomeScreen } from "@/components/mystery/home-screen";
import { CreateRoomScreen } from "@/components/mystery/create-room-screen";
import { JoinRoomScreen } from "@/components/mystery/join-room-screen";
import { LobbyScreen } from "@/components/mystery/lobby-screen";
import { GameScreen } from "@/components/mystery/game-screen";
import type { Profile } from "@/lib/types";

type View =
  | { name: "home" }
  | { name: "create" }
  | { name: "join"; code?: string }
  | { name: "lobby"; roomId: string }
  | { name: "game"; roomId: string };

export default function Home() {
  const { user, loading, login, register, logout } = useAuth();
  const [view, setView] = useState<View>({ name: "home" });
  const [trackedUserId, setTrackedUserId] = useState<string | null>(null);

  // Reset to home whenever user changes (login/logout transition)
  if (user && user.id !== trackedUserId) {
    setTrackedUserId(user.id);
    if (view.name !== "home") {
      setView({ name: "home" });
    }
  } else if (!user && trackedUserId !== null) {
    setTrackedUserId(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-mystery-gradient">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary via-fuchsia-500 to-primary animate-pulse-glow" />
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={() => setView({ name: "home" })}
        login={login}
        register={register}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        onLogout={async () => {
          await logout();
          setView({ name: "home" });
        }}
        onLogoClick={() => setView({ name: "home" })}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={view.name + (view.name === "lobby" || view.name === "game" ? view.roomId : view.name === "join" ? view.code ?? "" : "")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {view.name === "home" && (
            <HomeScreen
              user={user}
              onCreateRoom={() => setView({ name: "create" })}
              onJoinRoom={() => setView({ name: "join" })}
              onBrowseRooms={() => setView({ name: "join" })}
            />
          )}

          {view.name === "create" && (
            <CreateRoomScreen
              user={user}
              onBack={() => setView({ name: "home" })}
              onCreated={(roomId) => setView({ name: "lobby", roomId })}
            />
          )}

          {view.name === "join" && (
            <JoinRoomScreen
              user={user}
              initialCode={view.code}
              onBack={() => setView({ name: "home" })}
              onJoined={(roomId) => setView({ name: "lobby", roomId })}
            />
          )}

          {view.name === "lobby" && (
            <LobbyScreen
              user={user}
              roomId={view.roomId}
              onLeave={() => setView({ name: "home" })}
              onStart={() => setView({ name: "game", roomId: view.roomId })}
            />
          )}

          {view.name === "game" && (
            <GameScreen
              user={user}
              roomId={view.roomId}
              onLeave={() => setView({ name: "home" })}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <footer className="mt-auto border-t border-border/40 bg-background/50 py-6 text-center text-xs text-muted-foreground">
        <p>
          Mystery Room — منصة لعب اجتماعية بهويات مجهولة. صُممت بـ Next.js +
          Supabase-compatible schema + socket.io.
        </p>
      </footer>
    </div>
  );
}

// Suppress unused import warnings for types
export type { Profile };
