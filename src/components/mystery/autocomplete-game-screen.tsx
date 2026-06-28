"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Crown,
  Eye,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Volume2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
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

interface RoundInfo {
  id: string;
  phrase: string;
  roundNumber: number;
  timeLimit: number;
  createdAt: string;
}

interface AnswerInfo {
  id: string;
  answerText: string;
  usedVoice: boolean;
  responseTimeMs?: number;
  username?: string;
  avatar?: string;
  isMine?: boolean;
}

interface AutocompleteData {
  round: RoundInfo | null;
  myAnswer: AnswerInfo | null;
  answers: AnswerInfo[];
  answersCount?: number;
  playersCount?: number;
  revealed: boolean;
}

const ROUND_DURATION = 30;

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function AutocompleteGameScreen({ user, roomId, onLeave }: AutocompleteGameScreenProps) {
  const [data, setData] = useState<AutocompleteData | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [isCreator, setIsCreator] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  // Poll room state
  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/rooms/leave?roomId=${roomId}`);
    const d = await res.json();
    if (res.ok) {
      setRoomStatus(d.room.status);
      setIsCreator(d.me.isCreator);
    }
    return d;
  }, [roomId]);

  usePolling({ fetcher: fetchState, intervalMs: 1500 });

  // Poll autocomplete data
  const fetchAutocomplete = useCallback(async () => {
    const res = await fetch(`/api/autocomplete?roomId=${roomId}`);
    if (!res.ok) return null;
    const d = await res.json();
    return d as AutocompleteData;
  }, [roomId]);

  const { data: acData, refresh } = usePolling({
    fetcher: fetchAutocomplete,
    intervalMs: 1000,
  });

  useEffect(() => {
    if (acData) {
      setData(acData);
      if (acData.myAnswer && !answerText) {
        setAnswerText(acData.myAnswer.answerText);
      }
    }
  }, [acData, answerText]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAnswerText(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      toast({
        title: "خطأ في التعرف على الصوت",
        description: event.error === "not-allowed"
          ? "الرجاء السماح بالوصول للميكروفون"
          : "تعذّر التعرف على الصوت",
        variant: "destructive",
      });
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, [toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: "غير مدعوم",
        description: "متصفحك لا يدعم التعرف على الصوت",
        variant: "destructive",
      });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setAnswerText("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({ title: "🎙️ يتحدث الآن..." });
      } catch {
        toast({ title: "تعذّر بدء التسجيل", variant: "destructive" });
      }
    }
  };

  const handleSubmit = async () => {
    const text = answerText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          action: "submit_answer",
          answerText: text,
          usedVoice: isListening || answerText.length > 0,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "✅ تم إرسال إجابتك!" });
      refresh();
    } catch (e: any) {
      toast({ title: "تعذّر الإرسال", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewRound = async () => {
    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "new_round" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: `🎯 الجولة ${d.round.roundNumber}!` });
      setAnswerText("");
      refresh();
    } catch (e: any) {
      toast({ title: "تعذّر بدء الجولة", description: e?.message, variant: "destructive" });
    }
  };

  const handleReveal = async () => {
    try {
      const res = await fetch("/api/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "reveal" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      refresh();
    } catch (e: any) {
      toast({ title: "تعذّر الكشف", description: e?.message, variant: "destructive" });
    }
  };

  const handleAdvance = async (status: string) => {
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, status }),
      });
      refresh();
    } catch {}
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

  const round = data?.round;
  const myAnswer = data?.myAnswer;
  const answers = data?.answers ?? [];
  const revealed = data?.revealed ?? false;
  const canAnswer = roomStatus === "answering" && !myAnswer;
  const showAnswers = roomStatus === "revealing" || roomStatus === "chatting" || roomStatus === "finished";

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
            <Sparkles className="ml-1 h-3 w-3" />
            اتوبيس كومبليت
          </Badge>
        </div>

        {/* Phase banner */}
        <motion.div
          key={roomStatus}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-4 rounded-2xl border p-4 backdrop-blur",
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
                  {roomStatus === "waiting" ? "اضغط لبدء جولة جديدة" :
                   roomStatus === "answering" ? "أكمل الجملة بسرعة!" :
                   roomStatus === "revealing" ? "كشف الإجابات" :
                   roomStatus === "chatting" ? "نقاش مباشر" :
                   roomStatus === "finished" ? "الجولة منتهية" : roomStatus}
                </div>
                {round && (
                  <div className="text-xs text-muted-foreground">الجولة {round.roundNumber}</div>
                )}
              </div>
            </div>

            {roomStatus === "answering" && round && (
              <CountdownTimer
                duration={ROUND_DURATION}
                startedAt={new Date(round.createdAt).getTime()}
                variant="compact"
                className="font-mono text-lg font-bold"
                onComplete={() => {
                  if (isCreator) handleReveal();
                }}
              />
            )}

            {isCreator && (
              <div className="flex flex-wrap gap-2">
                {(roomStatus === "waiting" || (roomStatus === "answering" && !round)) && (
                  <Button size="sm" onClick={handleNewRound} className="animate-pulse-glow">
                    <Wand2 className="ml-1 h-4 w-4" /> جولة جديدة
                  </Button>
                )}
                {roomStatus === "answering" && round && (
                  <Button size="sm" variant="secondary" onClick={handleReveal}>
                    <Eye className="ml-1 h-4 w-4" /> اكشف
                  </Button>
                )}
                {roomStatus === "revealing" && (
                  <>
                    <Button size="sm" variant="default" onClick={handleNewRound}>
                      <RefreshCw className="ml-1 h-4 w-4" /> جولة جديدة
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleAdvance("chatting")}>
                      ابدأ النقاش
                    </Button>
                  </>
                )}
                {roomStatus === "chatting" && (
                  <Button size="sm" variant="secondary" onClick={() => handleAdvance("finished")}>
                    إنهاء
                  </Button>
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

        {/* Main content */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Left: game */}
          <div className="space-y-4">
            {/* Phrase display */}
            {round && (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="border-cyan-500/30 bg-cyan-500/5 backdrop-blur">
                  <CardContent className="p-5">
                    <div className="mb-2 text-xs font-medium text-cyan-300">📝 أكمل الجملة:</div>
                    <div className="text-xl font-bold sm:text-2xl leading-relaxed">
                      {round.phrase}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Answer input */}
            {canAnswer && round && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-border/40 bg-card/60 backdrop-blur">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">✍️ إجابتك</span>
                      <Button
                        size="sm"
                        variant={isListening ? "destructive" : "outline"}
                        onClick={toggleListening}
                        className={cn(isListening && "animate-pulse")}
                      >
                        {isListening ? <MicOff className="ml-1 h-4 w-4" /> : <Mic className="ml-1 h-4 w-4" />}
                        {isListening ? "يتحدث..." : "إدخال صوتي"}
                      </Button>
                    </div>
                    <Textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={isListening ? "🎙️ يتحدث الآن..." : "اكمل الجملة هنا..."}
                      className="bg-background/60 min-h-[70px] resize-none text-base"
                      maxLength={200}
                      disabled={submitting}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{answerText.length}/200</span>
                      <Button
                        onClick={handleSubmit}
                        disabled={submitting || answerText.trim().length === 0}
                        size="sm"
                      >
                        {submitting ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Send className="ml-1 h-4 w-4" />}
                        إرسال
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Already answered */}
            {myAnswer && !showAnswers && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                <div className="text-sm font-medium text-emerald-300">تم إرسال إجابتك!</div>
                <div className="mt-1 text-xs text-muted-foreground">بانتظار باقي اللاعبين...</div>
                {myAnswer.responseTimeMs && (
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    ⚡ {Math.round(myAnswer.responseTimeMs / 1000)}s
                  </Badge>
                )}
                {myAnswer.usedVoice && (
                  <Badge variant="outline" className="mt-2 mr-1 text-[10px] text-cyan-300">
                    🎙️ صوتي
                  </Badge>
                )}
              </div>
            )}

            {/* Progress during answering */}
            {!showAnswers && data?.answersCount !== undefined && data?.playersCount !== undefined && (
              <div className="text-center text-xs text-muted-foreground">
                {data.answersCount} / {data.playersCount} أجابوا
              </div>
            )}

            {/* Revealed answers */}
            {showAnswers && answers.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-muted-foreground">
                  الإجابات ({answers.length})
                </div>
                <AnimatePresence>
                  {answers.map((a, idx) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Card className={cn(
                        "border-border/40 bg-card/50 backdrop-blur",
                        a.isMine && "border-primary/40 bg-primary/5",
                        idx === 0 && "border-amber-500/40 bg-amber-500/10",
                      )}>
                        <CardContent className="p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-secondary text-xs">{a.avatar || "?"}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{a.username}</span>
                              {a.isMine && <Badge variant="outline" className="text-[10px]">أنت</Badge>}
                            </div>
                            <div className="flex items-center gap-1">
                              {a.usedVoice && (
                                <Badge variant="outline" className="text-[10px] text-cyan-300">
                                  <Mic className="h-2.5 w-2.5" /> صوتي
                                </Badge>
                              )}
                              {a.responseTimeMs && (
                                <Badge variant="outline" className="text-[10px]">
                                  ⚡ {Math.round(a.responseTimeMs / 1000)}s
                                </Badge>
                              )}
                              {idx === 0 && (
                                <Badge className="bg-amber-500/20 text-amber-300 text-[10px]">🏆 الأسرع</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-sm leading-relaxed">
                            <span className="text-muted-foreground">{round?.phrase} </span>
                            <span className="font-medium">{a.answerText}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Waiting state */}
            {roomStatus === "waiting" && !isCreator && (
              <Card className="border-dashed border-border/50 bg-card/30">
                <CardContent className="py-10 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-cyan-400/50" />
                  <p className="text-sm text-muted-foreground">
                    بانتظار أن يبدأ المنشئ جولة جديدة...
                  </p>
                </CardContent>
              </Card>
            )}

            {roomStatus === "answering" && !round && !isCreator && (
              <Card className="border-dashed border-border/50 bg-card/30">
                <CardContent className="py-10 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-cyan-400/50" />
                  <p className="text-sm text-muted-foreground">
                    بانتظار أن يبدأ المنشئ الجولة...
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: chat */}
          <div className="space-y-4">
            <ChatPanel
              roomId={roomId}
              anonymousName={user.username}
              enabled
              className="h-[400px] lg:h-[500px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
