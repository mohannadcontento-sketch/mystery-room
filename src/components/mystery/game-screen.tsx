"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  HelpCircle,
  Loader2,
  LogOut,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Users,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CountdownTimer } from "./countdown-timer";
import { ChatPanel } from "./chat-panel";
import { usePolling } from "@/hooks/use-polling";
import {
  GAME_MODE_LABELS,
  ROOM_STATUS_LABELS,
  type Answer,
  type GameMode,
  type Profile,
  type Question,
  type RoomPlayer,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface GameScreenProps {
  user: Profile;
  roomId: string;
  onLeave: () => void;
}

interface GameState {
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
  };
  players: RoomPlayer[];
  playersCount: number;
}

interface QuestionsResponse {
  questions: Question[];
}

interface AnswersResponse {
  answers: Answer[];
  count: number;
  revealed: boolean;
}

const ANSWERING_DURATION = 60;
const REVEALING_DURATION = 30;
const CHATTING_DURATION = 300;

export function GameScreen({ user, roomId, onLeave }: GameScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [myAnswers, setMyAnswers] = useState<Record<string, boolean>>({});
  const [roundStartedAt, setRoundStartedAt] = useState<number | undefined>();
  const [leaving, setLeaving] = useState(false);
  const [randomTarget, setRandomTarget] = useState<{ anonymousName: string; playerId: string } | null>(null);
  const [assigningTarget, setAssigningTarget] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [state, setState] = useState<GameState | null>(null);
  const { toast } = useToast();

  // Poll game state every 2s
  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/rooms/leave?roomId=${roomId}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    return {
      room: d.room,
      me: d.me,
      players: d.players,
      playersCount: d.playersCount,
    } as GameState;
  }, [roomId]);

  const { data: stateData, refresh: refreshState } = usePolling({
    fetcher: fetchState,
    intervalMs: 2000,
  });

  useEffect(() => {
    if (stateData) {
      setState(stateData);
      // Find my player ID
      const me = stateData.players.find((p) => p.isYou);
      if (me) {
        // store myPlayerId in state object
        (stateData as any).myPlayerId = me.id;
      }
    }
  }, [stateData]);

  // Poll questions every 2s
  const fetchQuestions = useCallback(async () => {
    const res = await fetch(`/api/questions?roomId=${roomId}`);
    const d: QuestionsResponse = await res.json();
    if (!res.ok) throw new Error(d as any);
    return d;
  }, [roomId]);

  const { data: questionsData } = usePolling({
    fetcher: fetchQuestions,
    intervalMs: 2000,
  });

  useEffect(() => {
    if (questionsData?.questions) {
      setQuestions(questionsData.questions);
    }
  }, [questionsData]);

  // Track round start time for the timer
  useEffect(() => {
    if (state?.room?.status === "answering" && !roundStartedAt) {
      setRoundStartedAt(Date.now());
    }
    if (state?.room?.status !== "answering" && state?.room?.status !== "chatting") {
      setRoundStartedAt(undefined);
    }
  }, [state?.room?.status, roundStartedAt]);

  // Fetch answers for each question (only when revealed)
  useEffect(() => {
    if (!state?.room) return;
    const status = state.room.status;
    if (!["revealing", "chatting", "finished"].includes(status)) return;

    questions.forEach(async (q) => {
      try {
        const res = await fetch(`/api/answers?questionId=${q.id}`);
        const d: AnswersResponse = await res.json();
        if (res.ok) {
          if (d.revealed) {
            setAnswers((prev) => ({ ...prev, [q.id]: d.answers ?? [] }));
          }
          setAnswerCounts((prev) => ({ ...prev, [q.id]: d.count ?? 0 }));
        }
      } catch {}
    });
  }, [questions, state?.room?.status]);

  // Also poll answer counts while answering (no text)
  useEffect(() => {
    if (state?.room?.status !== "answering") return;
    if (questions.length === 0) return;
    const id = setInterval(async () => {
      for (const q of questions) {
        try {
          const res = await fetch(`/api/answers?questionId=${q.id}`);
          const d: AnswersResponse = await res.json();
          if (res.ok) {
            setAnswerCounts((prev) => ({ ...prev, [q.id]: d.count ?? 0 }));
          }
        } catch {}
      }
    }, 2000);
    return () => clearInterval(id);
  }, [questions, state?.room?.status]);

  const changeState = async (newStatus: string) => {
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, status: newStatus }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setState((prev) =>
        prev ? { ...prev, room: { ...prev.room, status: newStatus } } : prev,
      );
      refreshState();
      if (newStatus === "revealing") {
        // Trigger answer fetch
        questions.forEach(async (q) => {
          try {
            const res = await fetch(`/api/answers?questionId=${q.id}`);
            const d: AnswersResponse = await res.json();
            if (res.ok && d.revealed) {
              setAnswers((prev) => ({ ...prev, [q.id]: d.answers ?? [] }));
            }
          } catch {}
        });
      }
      if (newStatus === "chatting") {
        setRoundStartedAt(Date.now());
      }
    } catch (e: any) {
      toast({
        title: "تعذّر تغيير الحالة",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateQuestion = async () => {
    const text = newQuestionText.trim();
    if (!text || submittingQuestion) return;
    setSubmittingQuestion(true);
    try {
      const targetPlayerId =
        state?.room?.gameMode === "question_for_random"
          ? randomTarget?.playerId
          : undefined;

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          questionText: text,
          targetPlayerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewQuestionText("");
      toast({
        title: "تم إرسال السؤال",
        description: "سؤالك مجهول ولن يُكشف أنك صاحبه.",
      });
      setRandomTarget(null);
      // Refresh questions immediately
      refreshState();
      setTimeout(() => {
        fetch(`/api/questions?roomId=${roomId}`)
          .then((r) => r.json())
          .then((d: QuestionsResponse) => {
            if (d.questions) setQuestions(d.questions);
          })
          .catch(() => {});
      }, 300);
    } catch (e: any) {
      toast({
        title: "تعذّر الإرسال",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleAssignRandom = async () => {
    if (assigningTarget) return;
    setAssigningTarget(true);
    try {
      const res = await fetch("/api/questions/random-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRandomTarget(data.target);
    } catch (e: any) {
      toast({
        title: "تعذّر التحديد",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setAssigningTarget(false);
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    const text = (answerDrafts[questionId] ?? "").trim();
    if (!text || submittingAnswer) return;
    setSubmittingAnswer(true);
    try {
      const res = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answerText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyAnswers((prev) => ({ ...prev, [questionId]: true }));
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: "" }));
      toast({ title: "تم إرسال إجابتك" });
    } catch (e: any) {
      toast({
        title: "تعذّر الإرسال",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingAnswer(false);
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

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل الغرفة...</p>
        </div>
      </div>
    );
  }

  const room = state.room;
  const status = room.status;
  const gameMode = room.gameMode;
  const isCreator = state.me.isCreator;
  const myAnonymousName = state.me.anonymousName;
  const myPlayerId = (state as any).myPlayerId as string | undefined;
  const currentQuestion = questions[questions.length - 1];

  return (
    <div className="relative min-h-screen bg-mystery-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-float" />
        <div
          className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl animate-float"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between gap-2">
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
            خروج
          </Button>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {room.roomCode}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border-primary/30",
                status === "answering" && "bg-primary/10 text-primary",
              )}
            >
              {ROOM_STATUS_LABELS[status as keyof typeof ROOM_STATUS_LABELS]}
            </Badge>
            <Badge variant="secondary">{GAME_MODE_LABELS[gameMode]}</Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={refreshState}
            className="text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Phase banner */}
        <PhaseBanner
          status={status}
          isCreator={isCreator}
          startedAt={roundStartedAt}
          answeringDuration={ANSWERING_DURATION}
          revealingDuration={REVEALING_DURATION}
          chattingDuration={CHATTING_DURATION}
          onAdvance={(next) => changeState(next)}
        />

        {/* Main grid */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Left column: question + answers */}
          <div className="space-y-4">
            {status === "answering" && (
              <AskQuestionCard
                gameMode={gameMode}
                isCreator={isCreator}
                text={newQuestionText}
                onText={setNewQuestionText}
                onSubmit={handleCreateQuestion}
                submitting={submittingQuestion}
                randomTarget={randomTarget}
                onAssignRandom={handleAssignRandom}
                assigning={assigningTarget}
              />
            )}

            {currentQuestion ? (
              <QuestionCard
                question={currentQuestion}
                status={status}
                answerCount={answerCounts[currentQuestion.id] ?? 0}
                answers={answers[currentQuestion.id] ?? []}
                myAnswered={!!myAnswers[currentQuestion.id]}
                draft={answerDrafts[currentQuestion.id] ?? ""}
                onDraft={(v) =>
                  setAnswerDrafts((prev) => ({
                    ...prev,
                    [currentQuestion.id]: v,
                  }))
                }
                onSubmitAnswer={() => handleSubmitAnswer(currentQuestion.id)}
                submitting={submittingAnswer}
                myPlayerId={myPlayerId}
              />
            ) : (
              status === "answering" && (
                <Card className="border-dashed border-border/50 bg-card/30">
                  <CardContent className="py-10 text-center">
                    <HelpCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      لا توجد أسئلة بعد. كن أول من يطرح سؤالاً مجهولاً!
                    </p>
                  </CardContent>
                </Card>
              )
            )}

            {questions.length > 1 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  الأسئلة السابقة
                </h3>
                <div className="space-y-2">
                  {questions.slice(0, -1).map((q) => (
                    <Card
                      key={q.id}
                      className="border-border/40 bg-card/40 backdrop-blur"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 text-sm">
                            <Badge variant="outline" className="mb-1">
                              جولة {q.round}
                            </Badge>
                            <div className="text-muted-foreground">
                              {q.questionText}
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {answerCounts[q.id] ?? 0} إجابة
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: players + chat */}
          <div className="space-y-4">
            <PlayersCard
              players={state.players}
              myAnonymousName={myAnonymousName}
              playersCount={state.playersCount}
            />

            <ChatPanel
              roomId={roomId}
              anonymousName={myAnonymousName}
              enabled
              className="h-[500px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PhaseBanner({
  status,
  isCreator,
  startedAt,
  answeringDuration,
  revealingDuration,
  chattingDuration,
  onAdvance,
}: {
  status: string;
  isCreator: boolean;
  startedAt?: number;
  answeringDuration: number;
  revealingDuration: number;
  chattingDuration: number;
  onAdvance: (next: "answering" | "revealing" | "chatting" | "finished") => void;
}) {
  const config = {
    waiting: {
      title: "في الانتظار",
      icon: <Users className="h-5 w-5" />,
      color: "from-slate-500/20 to-slate-700/10",
      desc: "بانتظار بدء الجولة",
    },
    answering: {
      title: "مرحلة الإجابة",
      icon: <HelpCircle className="h-5 w-5" />,
      color: "from-primary/20 to-fuchsia-500/10",
      desc: "اطرح سؤالاً واكتب إجاباتك مجهولة",
    },
    revealing: {
      title: "كشف الإجابات",
      icon: <Eye className="h-5 w-5" />,
      color: "from-amber-500/20 to-orange-500/10",
      desc: "الإجابات تظهر بدون أسماء أصحابها",
    },
    chatting: {
      title: "النقاش المباشر",
      icon: <MessageSquare className="h-5 w-5" />,
      color: "from-emerald-500/20 to-teal-500/10",
      desc: "ناقش الجولة بحرية لمدة 5 دقائق",
    },
    finished: {
      title: "الجولة منتهية",
      icon: <Sparkles className="h-5 w-5" />,
      color: "from-slate-500/20 to-slate-700/10",
      desc: "اضغط لبدء جولة جديدة",
    },
  }[status] ?? {
    title: status,
    icon: <Sparkles className="h-5 w-5" />,
    color: "from-slate-500/20 to-slate-700/10",
    desc: "",
  };

  const duration =
    status === "answering"
      ? answeringDuration
      : status === "revealing"
        ? revealingDuration
        : status === "chatting"
          ? chattingDuration
          : 0;

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-l p-4 backdrop-blur",
        config.color,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-background/40">
            {config.icon}
          </div>
          <div>
            <div className="font-semibold">{config.title}</div>
            <div className="text-xs text-muted-foreground">{config.desc}</div>
          </div>
        </div>

        {duration > 0 && (
          <CountdownTimer
            duration={duration}
            startedAt={startedAt}
            variant="compact"
            className="font-mono text-xl font-bold"
            onComplete={() => {
              if (status === "answering" && isCreator) onAdvance("revealing");
              else if (status === "revealing" && isCreator) onAdvance("chatting");
              else if (status === "chatting" && isCreator) onAdvance("finished");
            }}
          />
        )}

        {isCreator && (
          <div className="flex gap-2">
            {status === "waiting" && (
              <Button
                size="sm"
                onClick={() => onAdvance("answering")}
                className="animate-pulse-glow"
              >
                <Wand2 className="ml-1 h-4 w-4" />
                ابدأ الجولة
              </Button>
            )}
            {status === "answering" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAdvance("revealing")}
              >
                <Eye className="ml-1 h-4 w-4" />
                اكشف الإجابات
              </Button>
            )}
            {status === "revealing" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAdvance("chatting")}
              >
                <MessageSquare className="ml-1 h-4 w-4" />
                ابدأ النقاش
              </Button>
            )}
            {status === "chatting" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAdvance("finished")}
              >
                إنهاء الجولة
              </Button>
            )}
            {status === "finished" && (
              <Button size="sm" onClick={() => onAdvance("answering")}>
                <RefreshCw className="ml-1 h-4 w-4" />
                جولة جديدة
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AskQuestionCard({
  gameMode,
  text,
  onText,
  onSubmit,
  submitting,
  randomTarget,
  onAssignRandom,
  assigning,
}: {
  gameMode: GameMode;
  isCreator: boolean;
  text: string;
  onText: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  randomTarget: { anonymousName: string; playerId: string } | null;
  onAssignRandom: () => void;
  assigning: boolean;
}) {
  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4 text-primary" />
          {gameMode === "question_for_random"
            ? "اطرح سؤالاً لشخص مجهول"
            : "اطرح سؤالاً على الجميع"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {gameMode === "question_for_random" && (
          <div className="rounded-xl border border-border/40 bg-secondary/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />
                {randomTarget ? (
                  <>
                    <span className="text-muted-foreground">سترسل لـ:</span>
                    <span className="font-semibold text-primary">
                      {randomTarget.anonymousName}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    حدد لاعباً عشوائياً ليصلك سؤاله ويرد عليك
                  </span>
                )}
              </div>
              {!randomTarget && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onAssignRandom}
                  disabled={assigning}
                >
                  {assigning ? (
                    <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="ml-1 h-4 w-4" />
                  )}
                  اختر عشوائياً
                </Button>
              )}
            </div>
          </div>
        )}

        <Textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="اكتب سؤالك هنا... سيظهر مجهولاً للجميع"
          className="bg-background/60 min-h-[80px] resize-none"
          maxLength={280}
          disabled={
            submitting || (gameMode === "question_for_random" && !randomTarget)
          }
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {text.length}/280
          </span>
          <Button
            onClick={onSubmit}
            disabled={
              submitting ||
              text.trim().length < 3 ||
              (gameMode === "question_for_random" && !randomTarget)
            }
            size="sm"
          >
            {submitting ? (
              <Loader2 className="ml-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="ml-1 h-4 w-4" />
            )}
            إرسال مجهول
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionCard({
  question,
  status,
  answerCount,
  answers,
  myAnswered,
  draft,
  onDraft,
  onSubmitAnswer,
  submitting,
  myPlayerId,
}: {
  question: Question;
  status: string;
  answerCount: number;
  answers: Answer[];
  myAnswered: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onSubmitAnswer: () => void;
  submitting: boolean;
  myPlayerId?: string;
}) {
  const isTargetedToMe =
    question.targetPlayerId && question.targetPlayerId === myPlayerId;
  const canAnswer = status === "answering" && !myAnswered;
  const showAnswers = status === "revealing" || status === "chatting" || status === "finished";

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur bg-card-glow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">سؤال مجهول</CardTitle>
              <div className="text-xs text-muted-foreground">
                جولة {question.round}
                {isTargetedToMe && " · موجّه إليك"}
              </div>
            </div>
          </div>
          <Badge variant="secondary">{answerCount} إجابة</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/40 bg-background/40 p-4 text-lg font-medium">
          “{question.questionText}”
        </div>

        {canAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Textarea
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              placeholder="اكتب إجابتك المجهولة..."
              className="bg-background/60 min-h-[60px] resize-none"
              maxLength={500}
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {draft.length}/500
              </span>
              <Button
                onClick={onSubmitAnswer}
                disabled={submitting || draft.trim().length === 0}
                size="sm"
              >
                {submitting ? (
                  <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="ml-1 h-4 w-4" />
                )}
                إرسال الإجابة
              </Button>
            </div>
          </motion.div>
        )}

        {myAnswered && status === "answering" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <Sparkles className="ml-1 inline h-4 w-4" />
            تم إرسال إجابتك. بانتظار باقي اللاعبين...
          </div>
        )}

        {showAnswers && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground">
              الإجابات ({answers.length})
            </div>
            {answers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-4 text-center text-sm text-muted-foreground">
                لا توجد إجابات على هذا السؤال
              </div>
            ) : (
              <AnimatePresence>
                {answers.map((a, idx) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-xl border border-border/40 bg-secondary/30 p-3"
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-primary/15 text-[10px]">
                          ?
                        </AvatarFallback>
                      </Avatar>
                      لاعب مجهول
                    </div>
                    <div className="text-sm">{a.answerText}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlayersCard({
  players,
  myAnonymousName,
  playersCount,
}: {
  players: RoomPlayer[];
  myAnonymousName: string;
  playersCount: number;
}) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          اللاعبون
          <Badge variant="secondary" className="ml-auto">
            {playersCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-48 space-y-2 overflow-y-auto scroll-mystery">
          {players.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-lg p-2",
                p.anonymousName === myAnonymousName && "bg-primary/5",
              )}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-secondary text-xs">
                  {p.anonymousName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {p.anonymousName}
                {p.anonymousName === myAnonymousName && (
                  <span className="text-xs text-muted-foreground"> (أنت)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
