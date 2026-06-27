"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, HelpCircle, Loader2, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  GAME_MODE_DESCRIPTIONS,
  GAME_MODE_LABELS,
  type GameMode,
  type Profile,
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreateRoomScreenProps {
  user: Profile;
  onBack: () => void;
  onCreated: (roomId: string, gameMode: GameMode) => void;
}

export function CreateRoomScreen({
  user,
  onBack,
  onCreated,
}: CreateRoomScreenProps) {
  const [mode, setMode] = useState<GameMode>("question_for_all");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameMode: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر إنشاء الغرفة");
      toast({
        title: "تم إنشاء الغرفة",
        description: `كود الغرفة: ${data.room.roomCode}`,
      });
      onCreated(data.room.id, mode);
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err?.message || "حدث خطأ",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const modes: { id: GameMode; icon: React.ReactNode; tag: string }[] = [
    {
      id: "question_for_all",
      icon: <HelpCircle className="h-5 w-5" />,
      tag: "للجميع",
    },
    {
      id: "question_for_random",
      icon: <MessageCircle className="h-5 w-5" />,
      tag: "عشوائي",
    },
  ];

  return (
    <div className="relative min-h-screen bg-mystery-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <motion.button
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          العودة
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold sm:text-4xl">إنشاء غرفة جديدة</h1>
          <p className="mt-2 text-muted-foreground">
            اختر وضع اللعبة، وستحصل على كود سري لمشاركته مع أصدقائك.
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-8 space-y-4"
        >
          <Label>اختر وضع اللعب</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {modes.map((m) => {
              const selected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-5 text-right transition-all",
                    selected
                      ? "border-primary bg-primary/10 shadow-[0_0_30px_-10px_var(--primary)]"
                      : "border-border/50 bg-card/40 hover:border-primary/50 hover:bg-card/70",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground",
                      )}
                    >
                      {m.icon}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        selected
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {m.tag}
                    </span>
                  </div>
                  <div className="mt-3 font-semibold">
                    {GAME_MODE_LABELS[m.id]}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {GAME_MODE_DESCRIPTIONS[m.id]}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-8"
        >
          <Card className="border-border/40 bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">ماذا بعد؟</CardTitle>
              </div>
              <CardDescription>
                بمجرد الإنشاء، ستحصل على كود سري من 6 أحرف. شاركه مع أصدقائك
                ليدخلوا الغرفة. سيحصل كل لاعب على اسم مجهول تلقائياً.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="w-full sm:w-auto"
                size="lg"
              >
                {creating ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ الإنشاء...
                  </>
                ) : (
                  `إنشاء الغرفة كـ ${user.username}`
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-medium text-muted-foreground">{children}</div>
  );
}
