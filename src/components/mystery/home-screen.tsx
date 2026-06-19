"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  DoorClosed,
  DoorOpen,
  HelpCircle,
  Loader2,
  LogIn,
  MessageCircle,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
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
  type Room,
} from "@/lib/types";

interface HomeScreenProps {
  user: Profile;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onBrowseRooms: () => void;
}

export function HomeScreen({
  user,
  onCreateRoom,
  onJoinRoom,
  onBrowseRooms,
}: HomeScreenProps) {
  return (
    <div className="relative min-h-screen bg-mystery-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float" />
        <div
          className="absolute bottom-10 left-1/4 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl animate-float"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:py-16">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>أهلاً، {user.username}</span>
            <span className="text-lg leading-none">{user.avatar}</span>
          </div>
          <h1 className="bg-gradient-to-b from-foreground via-fuchsia-200 to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
            ابدأ مغامرتك المجهولة
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground sm:text-lg">
            أنشئ غرفة، ادعُ أصدقاءك بكود سري، واطرحوا أسئلة مجهولة بإجابات لا تكشف
            صاحبها. كل جولة تنتهي بنقاش جماعي مفتوح.
          </p>
        </motion.section>

        {/* Quick actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <ActionCard
            icon={<DoorOpen className="h-5 w-5" />}
            title="إنشاء غرفة"
            description="ابدأ غرفة جديدة وادعُ من تريد بكود سري."
            onClick={onCreateRoom}
            cta="غرفة جديدة"
            primary
          />
          <ActionCard
            icon={<LogIn className="h-5 w-5" />}
            title="دخول بكود"
            description="لديك كود من صديق؟ ادخل مباشرة."
            onClick={onJoinRoom}
            cta="ادخل بكود"
          />
          <ActionCard
            icon={<Users className="h-5 w-5" />}
            title="تصفح الغرف"
            description="شاهد الغرف المفتوحة وادخل أي منها."
            onClick={onBrowseRooms}
            cta="تصفح"
          />
        </motion.section>

        {/* Modes preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12"
        >
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Wand2 className="h-5 w-5 text-primary" />
            أوضاع اللعب
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModeCard
              mode="question_for_all"
              icon={<HelpCircle className="h-5 w-5" />}
            />
            <ModeCard
              mode="question_for_random"
              icon={<MessageCircle className="h-5 w-5" />}
            />
          </div>
        </motion.section>

        {/* How it works */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12"
        >
          <h2 className="mb-4 text-xl font-semibold">كيف تعمل الجولة؟</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { n: 1, t: "انتظار", d: "تجمع اللاعبون في اللوبي" },
              { n: 2, t: "إجابة", d: "تُطرح الأسئلة وتُكتب الإجابات مجهولة" },
              { n: 3, t: "كشف", d: "تظهر الإجابات بدون أسماء أصحابها" },
              { n: 4, t: "نقاش", d: "شات جماعي مفتوح لمدة 5 دقائق" },
            ].map((s) => (
              <Card
                key={s.n}
                className="border-border/40 bg-card/50 backdrop-blur"
              >
                <CardContent className="p-4">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {s.n}
                  </div>
                  <div className="text-sm font-semibold">{s.t}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.d}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  cta,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  cta: string;
  primary?: boolean;
}) {
  return (
    <Card
      className={`group relative overflow-hidden border-border/40 backdrop-blur transition-all hover:-translate-y-1 ${
        primary ? "bg-primary/10" : "bg-card/50"
      }`}
    >
      <div className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />
      <CardHeader>
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
            primary ? "bg-primary text-primary-foreground" : "bg-secondary"
          }`}
        >
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={onClick}
          variant={primary ? "default" : "secondary"}
          className="w-full"
        >
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}

function ModeCard({
  mode,
  icon,
}: {
  mode: GameMode;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            {icon}
          </div>
          <CardTitle className="text-base">
            {GAME_MODE_LABELS[mode]}
          </CardTitle>
        </div>
        <CardDescription className="pt-2">
          {GAME_MODE_DESCRIPTIONS[mode]}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
