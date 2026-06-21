"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Crown,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { usePolling } from "@/hooks/use-polling";
import {
  GAME_MODE_LABELS,
  type GameMode,
  type Profile,
  type RoomPlayer,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface LobbyScreenProps {
  user: Profile;
  roomId: string;
  onLeave: () => void;
  onStart: () => void;
}

interface LobbyData {
  roomCode: string;
  gameMode: GameMode;
  status: string;
  creatorId: string;
  myAnonymousName: string;
  isCreator: boolean;
  players: RoomPlayer[];
  playersCount: number;
}

export function LobbyScreen({
  user,
  roomId,
  onLeave,
  onStart,
}: LobbyScreenProps) {
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { toast } = useToast();

  const fetchLobby = useCallback(async () => {
    const res = await fetch(`/api/rooms/leave?roomId=${roomId}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    return d as LobbyData & { room: any; me: any; players: RoomPlayer[] };
  }, [roomId]);

  const { data, loading } = usePolling({
    fetcher: fetchLobby,
    intervalMs: 2000,
  });

  // If the game has started (status changed), jump to game screen
  useEffect(() => {
    if (data?.room?.status && data.room.status !== "waiting") {
      onStart();
    }
  }, [data?.room?.status, onStart]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/rooms/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onStart();
    } catch (e: any) {
      toast({
        title: "تعذّر البدء",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await fetch("/api/rooms/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
    } finally {
      setLeaving(false);
      onLeave();
    }
  };

  const copyCode = async () => {
    if (!data?.room?.roomCode) return;
    try {
      await navigator.clipboard.writeText(data.room.roomCode);
      toast({
        title: "تم النسخ",
        description: `كود الغرفة: ${data.room.roomCode}`,
      });
    } catch {
      toast({ title: "تعذّر النسخ", description: data.room.roomCode });
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل الغرفة...</p>
        </div>
      </div>
    );
  }

  const roomCode = data.room.roomCode;
  const gameMode = data.room.gameMode as GameMode;
  const status = data.room.status as string;
  const isCreator = data.me.isCreator;
  const myAnonymousName = data.me.anonymousName;
  const players = data.players;
  const playersCount = data.playersCount;

  return (
    <div className="relative min-h-screen bg-mystery-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-float" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            disabled={leaving}
            className="text-muted-foreground hover:text-destructive"
          >
            {leaving ? (
              <Loader2 className="ml-1 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="ml-1 h-4 w-4" />
            )}
            مغادرة
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            تحديث مباشر
          </div>
        </div>

        {/* Room code card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-border/40 bg-card/60 backdrop-blur bg-card-glow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                {GAME_MODE_LABELS[gameMode]}
              </div>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                كود الغرفة
              </CardTitle>
              <button onClick={copyCode} className="group relative mx-auto mt-2 inline-block">
                <div className="font-mono text-5xl font-bold tracking-[0.3em] text-glow-primary sm:text-6xl">
                  {roomCode}
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-primary">
                  <Copy className="h-3 w-3" />
                  اضغط للنسخ
                </div>
              </button>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-secondary/30 p-3 text-center text-sm">
                <span className="text-muted-foreground">هويتك المجهولة: </span>
                <span className="font-semibold text-primary">
                  {myAnonymousName}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Players list */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-4 w-4 text-primary" />
              اللاعبون
              <Badge variant="secondary" className="rounded-full">
                {playersCount}
              </Badge>
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-3 backdrop-blur",
                  p.isYou && "border-primary/60 bg-primary/5",
                )}
              >
                <Avatar className="h-10 w-10 border border-border/60">
                  <AvatarFallback className="bg-secondary text-base">
                    {p.anonymousName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.anonymousName}</span>
                    {p.isCreator && (
                      <Crown className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.isYou ? "أنت" : "لاعب مجهول"}
                    {p.isCreator && " · المنشئ"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Start button — only creator */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          {isCreator ? (
            <Button
              onClick={handleStart}
              disabled={starting || playersCount < 2}
              size="lg"
              className="w-full h-14 text-base shadow-[0_0_40px_-10px_var(--primary)]"
            >
              {starting ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جارٍ بدء الجولة...
                </>
              ) : (
                <>
                  <Play className="ml-2 h-5 w-5" />
                  ابدأ الجولة
                </>
              )}
            </Button>
          ) : (
            <Card className="border-border/40 bg-card/40">
              <CardContent className="py-6 text-center">
                <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  بانتظار أن يبدأ منشئ الغرفة الجولة...
                </p>
              </CardContent>
            </Card>
          )}
          {isCreator && playersCount < 2 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              يلزم لاعبان على الأقل لبدء اللعبة. شارك الكود مع صديق!
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
