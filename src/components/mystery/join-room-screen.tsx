"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  DoorClosed,
  Loader2,
  LogIn,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  GAME_MODE_LABELS,
  ROOM_STATUS_LABELS,
  type Profile,
  type Room,
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface JoinRoomScreenProps {
  user: Profile;
  initialCode?: string;
  onBack: () => void;
  onJoined: (roomId: string) => void;
}

export function JoinRoomScreen({
  user,
  initialCode,
  onBack,
  onJoined,
}: JoinRoomScreenProps) {
  const [code, setCode] = useState(initialCode ?? "");
  const [joining, setJoining] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const { toast } = useToast();

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (res.ok) setRooms(data.rooms ?? []);
    } catch {
      // silent
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleJoin = async (codeToJoin?: string) => {
    const finalCode = (codeToJoin ?? code).trim().toUpperCase();
    if (finalCode.length !== 6) {
      toast({
        title: "كود غير صالح",
        description: "الكود يجب أن يكون 6 أحرف.",
        variant: "destructive",
      });
      return;
    }
    setJoining(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: finalCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر دخول الغرفة");
      toast({
        title: "أهلاً بك في الغرفة",
        description: data.alreadyMember
          ? "عدت إلى الغرفة."
          : `دخلت الغرفة بهوية مجهولة.`,
      });
      onJoined(data.room.id);
    } catch (err: any) {
      toast({
        title: "تعذّر الدخول",
        description: err?.message || "حدث خطأ",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-mystery-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <motion.button
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          العودة
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold sm:text-4xl">ادخل غرفة بكود</h1>
          <p className="mt-2 text-muted-foreground">
            أدخل الكود الذي حصلت عليه من صديقك، أو تصفح الغرف المفتوحة بالأسفل.
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <Card className="border-border/40 bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <LogIn className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">الكود السري</CardTitle>
              </div>
              <CardDescription>
                6 أحرف إنجليزية كبيرة (A-Z, 2-9)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) handleJoin();
                }}
                placeholder="ABCDEF"
                className="text-center text-2xl font-mono tracking-[0.4em] h-14 bg-background/60"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
              />
              <Button
                onClick={() => handleJoin()}
                disabled={joining || code.length !== 6}
                className="w-full"
                size="lg"
              >
                {joining ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ الدخول...
                  </>
                ) : (
                  "ادخل الغرفة"
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <DoorClosed className="h-4 w-4 text-primary" />
              غرف مفتوحة
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRooms}
              disabled={loadingRooms}
            >
              {loadingRooms ? "جارٍ التحديث..." : "تحديث"}
            </Button>
          </div>

          {loadingRooms ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl bg-card/40 animate-pulse"
                />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <Card className="border-dashed border-border/50 bg-card/30">
              <CardContent className="py-10 text-center text-muted-foreground">
                <DoorClosed className="mx-auto mb-3 h-8 w-8 opacity-50" />
                لا توجد غرف مفتوحة الآن. أنشئ واحدة وادعُ أصدقاءك!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setCode(r.roomCode);
                    handleJoin(r.roomCode);
                  }}
                  disabled={joining}
                  className="group flex items-center justify-between rounded-2xl border border-border/40 bg-card/50 p-4 text-right transition-all hover:border-primary/60 hover:bg-card/80 hover:shadow-[0_0_25px_-10px_var(--primary)] disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-mono text-sm font-bold text-primary">
                      {r.roomCode.slice(0, 3)}
                      <br />
                      {r.roomCode.slice(3)}
                    </div>
                    <div>
                      <div className="font-mono font-semibold tracking-wider">
                        {r.roomCode}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {GAME_MODE_LABELS[r.gameMode as keyof typeof GAME_MODE_LABELS]}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {r.playersCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {ROOM_STATUS_LABELS[r.status as keyof typeof ROOM_STATUS_LABELS]}
                    </span>
                    <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-[-3px]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
