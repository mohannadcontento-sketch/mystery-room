"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface PlayerWithReady extends RoomPlayer {
  isReady?: boolean;
  readyAt?: string | null;
  username?: string;
  avatar?: string;
}

interface LobbyData {
  room: {
    id: string;
    roomCode: string;
    gameMode: GameMode;
    status: string;
    creatorId: string;
    createdAt: string;
  };
  me: {
    anonymousName: string;
    isCreator: boolean;
    playerId: string;
    readyAt: string | null;
    isReady: boolean;
  };
  players: PlayerWithReady[];
  playersCount: number;
  readyCount: number;
  allReady: boolean;
}

export function LobbyScreen({ user, roomId, onLeave, onStart }: LobbyScreenProps) {
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [togglingReady, setTogglingReady] = useState(false);
  const { toast } = useToast();

  const fetchLobby = useCallback(async () => {
    const res = await fetch(`/api/rooms/leave?roomId=${roomId}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    return d as LobbyData;
  }, [roomId]);

  const { data, loading } = usePolling({ fetcher: fetchLobby, intervalMs: 1000 });

  // If game started, go to game screen
  useEffect(() => {
    if (data?.room?.status && data.room.status !== "waiting") {
      onStart();
    }
  }, [data?.room?.status, onStart]);

  // Auto-start when all ready (creator triggers)
  useEffect(() => {
    if (!data?.allReady || !data?.me?.isCreator) return;
    if (data?.room?.status !== "waiting") return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/rooms/ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, ready: true }),
        });
        if (res.ok) onStart();
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [data?.allReady, data?.me?.isCreator, data?.room?.status, roomId, onStart]);

  const toggleReady = async () => {
    if (togglingReady) return;
    setTogglingReady(true);
    const newReady = !data?.me?.isReady;
    try {
      const res = await fetch("/api/rooms/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, ready: newReady }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({
        title: newReady ? "أنت جاهز!" : "تم إلغاء الجاهزية",
      });
    } catch (e: any) {
      toast({
        title: "تعذّر التحديث",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setTogglingReady(false);
    }
  };

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
      toast({ title: "تم النسخ", description: `كود الغرفة: ${data.room.roomCode}` });
    } catch {
      toast({ title: "تعذّر النسخ", description: data.room.roomCode });
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roomCode = data.room.roomCode;
  const gameMode = data.room.gameMode;
  const isCreator = data.me.isCreator;
  const myReady = data.me.isReady;
  const players = data.players;
  const playersCount = data.playersCount;
  const readyCount = data.readyCount;
  const allReady = data.allReady;

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
            {leaving ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <LogOut className="ml-1 h-4 w-4" />}
            مغادرة
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            تحديث مباشر
          </div>
        </div>

        {/* Room code */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-border/40 bg-card/60 backdrop-blur bg-card-glow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                {GAME_MODE_LABELS[gameMode]}
              </div>
              <CardTitle className="text-sm font-normal text-muted-foreground">كود الغرفة</CardTitle>
              <button onClick={copyCode} className="group relative mx-auto mt-2 inline-block">
                <div className="font-mono text-5xl font-bold tracking-[0.3em] text-glow-primary sm:text-6xl">
                  {roomCode}
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                  <Copy className="h-3 w-3" /> اضغط للنسخ
                </div>
              </button>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Ready progress */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-4">
          <Card className={cn("border-border/40 backdrop-blur transition-colors", allReady ? "border-emerald-500/60 bg-emerald-500/10" : "bg-card/40")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {allReady ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Users className="h-5 w-5 text-primary" />}
                  <div>
                    <div className="text-sm font-semibold">
                      {allReady ? "الجميع جاهز!" : `جاهزون: ${readyCount} / ${playersCount}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {allReady ? "الجولة ستبدأ..." : "اضغط 'أنا جاهز' لبدء الجولة"}
                    </div>
                  </div>
                </div>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", allReady ? "bg-emerald-500 w-full" : "bg-primary")}
                    style={{ width: `${playersCount > 0 ? (readyCount / playersCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Players */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">اللاعبون</h2>
            <Badge variant="secondary" className="rounded-full">{playersCount}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-3 backdrop-blur transition-all",
                  p.isYou && "border-primary/60 bg-primary/5",
                  p.isReady && "border-emerald-500/40 bg-emerald-500/5",
                )}
              >
                <Avatar className="h-10 w-10 border border-border/60">
                  <AvatarFallback className="bg-secondary text-base">{p.avatar || p.anonymousName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.username || p.anonymousName}</span>
                    {p.isCreator && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    {p.isReady && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.isYou ? "أنت" : p.isReady ? "جاهز" : "بانتظار الجاهزية"}
                    {p.isCreator && " · المنشئ"}
                  </div>
                </div>
                {p.isReady && (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px]">جاهز</Badge>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Ready + Start buttons */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6 space-y-3">
          {/* Ready button (for everyone) */}
          <Button
            onClick={toggleReady}
            disabled={togglingReady}
            size="lg"
            variant={myReady ? "secondary" : "default"}
            className={cn(
              "w-full h-14 text-base",
              !myReady && "shadow-[0_0_40px_-10px_var(--primary)]",
              myReady && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
            )}
          >
            {togglingReady ? (
              <Loader2 className="ml-2 h-5 w-5 animate-spin" />
            ) : myReady ? (
              <><CheckCircle2 className="ml-2 h-5 w-5" /> أنت جاهز — اضغط للإلغاء</>
            ) : (
              <><CheckCircle2 className="ml-2 h-5 w-5" /> أنا جاهز</>
            )}
          </Button>

          {/* Manual start — only creator */}
          {isCreator && (
            <Button onClick={handleStart} disabled={starting || playersCount < 2} size="lg" variant="outline" className="w-full h-12">
              {starting ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جارٍ بدء الجولة...</> : <><Play className="ml-2 h-4 w-4" /> بدء فوري (بدون انتظار)</>}
            </Button>
          )}
          {isCreator && playersCount < 2 && (
            <p className="text-center text-xs text-muted-foreground">يلزم لاعبان على الأقل. شارك الكود!</p>
          )}
          {!isCreator && (
            <p className="text-center text-xs text-muted-foreground">
              {allReady ? "🎯 الجولة ستبدأ تلقائياً!" : "اضغط 'أنا جاهز'. الجولة تبدأ عندما يكون الجميع جاهزين."}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
