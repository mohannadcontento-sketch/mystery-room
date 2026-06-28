"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, CheckCircle2, Eye, Loader2, LogOut, Mic, MicOff,
  RefreshCw, Send, Sparkles, Timer, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountdownTimer } from "./countdown-timer";
import { ChatPanel } from "./chat-panel";
import { usePolling } from "@/hooks/use-polling";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AutocompleteGameScreenProps {
  user: Profile;
  roomId: string;
  onLeave: () => void;
}

const CATEGORIES = [
  { key: "boy_name", label: "ولد", icon: "👦", placeholder: "اسم ولد" },
  { key: "girl_name", label: "بنت", icon: "👧", placeholder: "اسم بنت" },
  { key: "animal", label: "حيوان", icon: "🦁", placeholder: "اسم حيوان" },
  { key: "country", label: "بلاد", icon: "🌍", placeholder: "اسم بلد" },
  { key: "plant", label: "نبات", icon: "🌱", placeholder: "اسم نبات" },
] as const;

const ROUND_DURATION = 60;

export function AutocompleteGameScreen({ user, roomId, onLeave }: AutocompleteGameScreenProps) {
  const [data, setData] = useState<any>(null);
  const [answers, setAnswers] = useState({ boy_name: "", girl_name: "", animal: "", country: "", plant: "" });
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/autocomplete?roomId=${roomId}`);
    if (!res.ok) return null;
    return await res.json();
  }, [roomId]);

  const { data: polled, refresh } = usePolling({ fetcher: fetchData, intervalMs: 1500 });

  useEffect(() => {
    if (polled) {
      setData(polled);
      // Initialize scores from existing corrected answers
      if (polled.allAnswers) {
        const s: Record<string, number> = {};
        for (const a of polled.allAnswers) {
          if (a.corrected) s[a.id] = a.score;
        }
        setScores(s);
      }
    }
  }, [polled]);

  const round = data?.round;
  const roomStatus = data?.roomStatus ?? "waiting";
  const isCreator = data?.isCreator ?? false;
  const myAnswer = data?.myAnswer;
  const allAnswers = data?.allAnswers ?? [];
  const answersCount = data?.answersCount ?? 0;
  const playersCount = data?.playersCount ?? 0;

  const canAnswer = roomStatus === "answering" && round && !myAnswer;
  const showResults = ["revealing", "chatting", "finished"].includes(roomStatus);

  const handleNewRound = async () => {
    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "new_round" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: `🎯 الجولة ${d.round.round_number} — الحرف: ${d.round.letter}` });
      setAnswers({ boy_name: "", girl_name: "", animal: "", country: "", plant: "" });
      refresh();
    } catch (e: any) {
      toast({ title: "تعذّر", description: e?.message, variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "submit_answer", answers, usedVoice: false }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "✅ تم إرسال إجاباتك!" });
      refresh();
    } catch (e: any) {
      toast({ title: "تعذّر", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReveal = async () => {
    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "reveal" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      refresh();
    } catch (e: any) {
      toast({ title: "تعذّر", description: e?.message, variant: "destructive" });
    }
  };

  const handleCorrect = async (answerId: string, score: number) => {
    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "correct", answerId, score }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setScores((prev) => ({ ...prev, [answerId]: score }));
      toast({ title: `✅ النتيجة: ${score}/50` });
    } catch (e: any) {
      toast({ title: "تعذّر", description: e?.message, variant: "destructive" });
    }
  };

  const handleAdvance = async (status: string) => {
    try {
      await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId, status }) });
      refresh();
    } catch {}
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await fetch("/api/rooms/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId }) });
    } finally {
      setLeaving(false);
      onLeave();
    }
  };

  // Calculate each answer's score based on creator's corrections
  const getAnswerScore = (a: any) => {
    if (scores[a.id] !== undefined) return scores[a.id];
    if (a.corrected) return a.score;
    return null;
  };

  // Auto-calculate score for an answer (10 per non-empty field)
  const calcAutoScore = (a: any) => {
    let s = 0;
    if (a.boyName?.trim()) s += 10;
    if (a.girlName?.trim()) s += 10;
    if (a.animal?.trim()) s += 10;
    if (a.country?.trim()) s += 10;
    if (a.plant?.trim()) s += 10;
    return s;
  };

  return (
    <div className="relative min-h-screen bg-mystery-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl animate-float" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-8">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleLeave} disabled={leaving} className="text-muted-foreground hover:text-destructive">
            {leaving ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <LogOut className="ml-1 h-4 w-4" />}
            خروج
          </Button>
          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            <Sparkles className="ml-1 h-3 w-3" /> اتوبيس كومبليت
          </Badge>
        </div>

        {/* Phase banner */}
        <motion.div key={roomStatus} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={cn("mb-4 rounded-2xl border p-3 backdrop-blur sm:p-4",
            roomStatus === "answering" ? "border-cyan-500/40 bg-cyan-500/10" :
            roomStatus === "revealing" ? "border-amber-500/40 bg-amber-500/10" :
            roomStatus === "chatting" ? "border-emerald-500/40 bg-emerald-500/10" :
            "border-border/40 bg-card/40"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-background/40">
                {roomStatus === "answering" ? <Timer className="h-4 w-4 text-cyan-300" /> :
                 roomStatus === "revealing" ? <Eye className="h-4 w-4 text-amber-300" /> :
                 <Sparkles className="h-4 w-4" />}
              </div>
              <div>
                <div className="text-sm font-semibold">
                  {roomStatus === "waiting" ? "اضغط لبدء جولة" :
                   roomStatus === "answering" ? "أكمل الفئات بسرعة!" :
                   roomStatus === "revealing" ? "مراجعة الإجابات" :
                   roomStatus === "chatting" ? "نقاش مباشر" : "منتهية"}
                </div>
                {round && <div className="text-xs text-muted-foreground">الجولة {round.roundNumber}</div>}
              </div>
            </div>

            {roomStatus === "answering" && round && (
              <CountdownTimer duration={ROUND_DURATION} startedAt={new Date(round.createdAt).getTime()} variant="compact"
                className="font-mono text-lg font-bold"
                onComplete={() => { if (isCreator) handleReveal(); }}
              />
            )}

            {isCreator && (
              <div className="flex flex-wrap gap-2">
                {(roomStatus === "waiting" || (roomStatus === "answering" && !round)) && (
                  <Button size="sm" onClick={handleNewRound} className="animate-pulse-glow">
                    <Sparkles className="ml-1 h-4 w-4" /> جولة جديدة
                  </Button>
                )}
                {roomStatus === "answering" && round && (
                  <Button size="sm" variant="secondary" onClick={handleReveal}>
                    <Eye className="ml-1 h-4 w-4" /> اكشف
                  </Button>
                )}
                {roomStatus === "revealing" && (
                  <Button size="sm" variant="secondary" onClick={() => handleAdvance("chatting")}>
                    ابدأ النقاش
                  </Button>
                )}
                {roomStatus === "chatting" && (
                  <Button size="sm" variant="secondary" onClick={() => handleAdvance("finished")}>إنهاء</Button>
                )}
                {roomStatus === "finished" && (
                  <Button size="sm" onClick={handleNewRound}>
                    <RefreshCw className="ml-1 h-4 w-4" /> جولة جديدة
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Letter display */}
        {round && (
          <motion.div key={round.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
            <Card className="border-cyan-500/30 bg-cyan-500/5 backdrop-blur">
              <CardContent className="flex items-center justify-center py-6">
                <div className="text-center">
                  <div className="text-xs font-medium text-cyan-300 mb-1">الحرف</div>
                  <div className="text-6xl font-bold text-glow-primary sm:text-7xl">{round.letter}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {/* Answer form */}
            {canAnswer && round && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-border/40 bg-card/60 backdrop-blur">
                  <CardHeader><CardTitle className="text-base">✍️ اكتب إجاباتك — حرف {round.letter}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {CATEGORIES.map((cat) => (
                      <div key={cat.key} className="flex items-center gap-2">
                        <Label className="flex w-20 shrink-0 items-center gap-1 text-sm">
                          <span className="text-lg">{cat.icon}</span> {cat.label}
                        </Label>
                        <Input
                          value={answers[cat.key]}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                          placeholder={`${cat.placeholder} يبدأ بـ ${round.letter}`}
                          className="bg-background/60"
                          maxLength={50}
                          disabled={submitting}
                        />
                      </div>
                    ))}
                    <Button onClick={handleSubmit} disabled={submitting || !Object.values(answers).some(v => v.trim())} className="w-full" size="lg">
                      {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
                      إرسال الإجابات
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Already answered */}
            {myAnswer && !showResults && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                <div className="text-sm font-medium text-emerald-300">تم إرسال إجاباتك!</div>
                <div className="mt-1 text-xs text-muted-foreground">{answersCount} / {playersCount} أجابوا</div>
              </div>
            )}

            {/* Progress */}
            {!showResults && round && !myAnswer && (
              <div className="text-center text-xs text-muted-foreground">{answersCount} / {playersCount} أجابوا</div>
            )}

            {/* Results — revealing/chatting */}
            {showResults && allAnswers.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-muted-foreground">الإجابات ({allAnswers.length})</div>
                {allAnswers.map((a, idx) => {
                  const score = getAnswerScore(a);
                  const autoScore = calcAutoScore(a);
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}>
                      <Card className={cn("border-border/40 bg-card/50 backdrop-blur", a.isMine && "border-primary/40 bg-primary/5")}>
                        <CardContent className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8"><AvatarFallback className="bg-secondary text-sm">{a.avatar || "?"}</AvatarFallback></Avatar>
                              <span className="text-sm font-medium">{a.username}</span>
                              {a.isMine && <Badge variant="outline" className="text-[10px]">أنت</Badge>}
                            </div>
                            {score !== null ? (
                              <Badge className={cn("text-sm", score >= 40 ? "bg-emerald-500/20 text-emerald-300" : score >= 20 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300")}>
                                {score}/50
                              </Badge>
                            ) : isCreator ? (
                              <Badge variant="outline" className="text-[10px] text-amber-300">في انتظار التصحيح</Badge>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {CATEGORIES.map((cat) => {
                              const val = a[cat.key.replace("boy_name","boyName").replace("girl_name","girlName")] || a[cat.key] || "";
                              return (
                                <div key={cat.key} className="flex items-center gap-2 rounded-lg bg-background/40 p-2 text-sm">
                                  <span className="text-lg">{cat.icon}</span>
                                  <span className="text-xs text-muted-foreground">{cat.label}:</span>
                                  <span className={cn("font-medium", !val.trim() && "text-muted-foreground italic")}>
                                    {val.trim() || "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Creator correction */}
                          {isCreator && roomStatus === "revealing" && (
                            <div className="mt-3 border-t border-border/30 pt-3">
                              <div className="mb-2 text-xs font-medium text-muted-foreground">التصحيح — اضغط على كل فقرة:</div>
                              <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => {
                                  const key = cat.key.replace("boy_name","boyName").replace("girl_name","girlName");
                                  const val = a[key] || a[cat.key] || "";
                                  const fieldScore = scores[`${a.id}_${cat.key}`];
                                  return (
                                    <CategoryCorrectButton
                                      key={cat.key}
                                      label={cat.label}
                                      icon={cat.icon}
                                      value={val}
                                      score={fieldScore}
                                      onCorrect={(s) => {
                                        const currentTotal = scores[a.id] ?? 0;
                                        const oldField = scores[`${a.id}_${cat.key}`] ?? 0;
                                        const newTotal = currentTotal - oldField + s;
                                        setScores((prev) => ({ ...prev, [`${a.id}_${cat.key}`]: s }));
                                        handleCorrect(a.id, newTotal);
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}

                {/* Leaderboard */}
                {showResults && (
                  <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur">
                    <CardHeader><CardTitle className="text-base">🏆 النتائج</CardTitle></CardHeader>
                    <CardContent>
                      {[...allAnswers]
                        .sort((a, b) => (getAnswerScore(b) ?? 0) - (getAnswerScore(a) ?? 0))
                        .map((a, idx) => (
                          <div key={a.id} className={cn("flex items-center gap-3 rounded-lg p-2", a.isMine && "bg-primary/5")}>
                            <div className="w-6 text-center font-bold text-muted-foreground">{idx + 1}</div>
                            <Avatar className="h-8 w-8"><AvatarFallback className="bg-secondary text-sm">{a.avatar}</AvatarFallback></Avatar>
                            <div className="flex-1">
                              <span className="text-sm font-medium">{a.username}</span>
                              {a.isMine && <span className="text-xs text-muted-foreground"> (أنت)</span>}
                            </div>
                            <Badge className={cn(idx === 0 && getAnswerScore(a) > 0 ? "bg-amber-500/20 text-amber-300" : "")}>
                              {getAnswerScore(a) ?? 0}/50
                            </Badge>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Waiting */}
            {!round && !isCreator && (
              <Card className="border-dashed border-border/50 bg-card/30">
                <CardContent className="py-10 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-cyan-400/50" />
                  <p className="text-sm text-muted-foreground">بانتظار أن يبدأ المنشئ جولة...</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat */}
          <div>
            <ChatPanel roomId={roomId} anonymousName={user.username} enabled className="h-[400px] lg:h-[500px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryCorrectButton({ label, icon, value, score, onCorrect }: {
  label: string; icon: string; value: string; score?: number; onCorrect: (s: number) => void;
}) {
  if (!value.trim()) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-secondary/20 px-2 py-1 text-xs text-muted-foreground">
        <span>{icon}</span> {label}: —
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs">{icon} {label}:</span>
      <Button size="sm" variant={score === 10 ? "default" : "outline"} className="h-6 px-2 text-[10px]"
        onClick={() => onCorrect(score === 10 ? 0 : 10)}
      >
        {score === 10 ? <><Check className="h-3 w-3" /> 10</> : <><X className="h-3 w-3" /> 0</>}
      </Button>
    </div>
  );
}
