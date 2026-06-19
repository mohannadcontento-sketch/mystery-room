"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarPicker } from "./avatar-picker";
import { Logo } from "./logo";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/lib/types";

interface AuthScreenProps {
  onAuthenticated: (user: Profile) => void;
  login: (u: string, p: string) => Promise<Profile>;
  register: (u: string, p: string, a: string) => Promise<Profile>;
}

export function AuthScreen({
  onAuthenticated,
  login,
  register,
}: AuthScreenProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const { toast } = useToast();

  // shared form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (username.trim().length < 3) {
      toast({
        title: "اسم المستخدم قصير جداً",
        description: "يجب أن يكون 3 أحرف على الأقل.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        title: "كلمة المرور ضعيفة",
        description: "يجب أن تكون 6 أحرف على الأقل.",
        variant: "destructive",
      });
      return;
    }
    if (tab === "register" && !avatar) {
      toast({
        title: "اختر شخصية",
        description: "اختر صورة رمزية تمثلك.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const user =
        tab === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password, avatar);
      toast({
        title: `أهلاً ${user.username} 👋`,
        description: "تم تسجيل الدخول بنجاح.",
      });
      onAuthenticated(user);
    } catch (err: any) {
      toast({
        title: "تعذّر الإكمال",
        description: err?.message || "حدث خطأ غير متوقع.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-mystery-gradient">
      {/* Floating decorative orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float" />
        <div
          className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl animate-float"
          style={{ animationDelay: "0.8s" }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="mb-4 flex justify-center">
            <Logo size="lg" showText={false} />
          </div>
          <h1 className="bg-gradient-to-b from-foreground via-fuchsia-200 to-foreground/80 bg-clip-text text-4xl font-bold tracking-tight text-transparent text-glow-primary sm:text-5xl">
            Mystery Room
          </h1>
          <p className="mt-3 text-muted-foreground">
            غرف لعب جماعية بأسئلة وإجابات مجهولة
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl border border-border/40 bg-card/70 p-6 bg-card-glow backdrop-blur-xl sm:p-8"
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">دخول</TabsTrigger>
              <TabsTrigger value="register">حساب جديد</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <TabsContent value="login" className="mt-0 space-y-4">
                <Field
                  id="login-username"
                  label="اسم المستخدم"
                  icon={<UserIcon className="h-4 w-4" />}
                >
                  <Input
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ghost_fox"
                    autoComplete="username"
                    className="bg-background/60"
                  />
                </Field>
                <Field
                  id="login-password"
                  label="كلمة المرور"
                  icon={<Lock className="h-4 w-4" />}
                >
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="bg-background/60 pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
              </TabsContent>

              <TabsContent value="register" className="mt-0 space-y-4">
                <Field
                  id="reg-username"
                  label="اسم المستخدم"
                  icon={<UserIcon className="h-4 w-4" />}
                >
                  <Input
                    id="reg-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ghost_fox"
                    autoComplete="username"
                    className="bg-background/60"
                  />
                </Field>
                <Field
                  id="reg-password"
                  label="كلمة المرور"
                  icon={<Lock className="h-4 w-4" />}
                >
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6 أحرف على الأقل"
                      autoComplete="new-password"
                      className="bg-background/60 pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
                <AvatarPicker value={avatar} onChange={setAvatar} />
              </TabsContent>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 text-base shadow-[0_8px_30px_-10px_var(--primary)]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جارٍ المعالجة...
                      </>
                    ) : tab === "login" ? (
                      "ادخل الغرفة"
                    ) : (
                      "أنشئ حسابي"
                    )}
                  </Button>
                </motion.div>
              </AnimatePresence>
            </form>
          </Tabs>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          هويتك داخل الغرفة تكون مجهولة دائماً — لا أحد يعرف من وراء السؤال أو الإجابة.
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}
