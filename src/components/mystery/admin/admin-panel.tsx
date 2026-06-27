"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Crown,
  Loader2,
  MessageSquare,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminPanelProps {
  user: Profile;
  onBack: () => void;
}

interface AdminUser {
  id: string;
  username: string;
  avatar: string;
  role: string;
  created_at: string;
}

interface AdminRoom {
  id: string;
  roomCode: string;
  gameMode: string;
  status: string;
  createdAt: string;
  creatorUsername: string;
  creatorAvatar: string;
  playersCount: number;
}

interface Stats {
  users: number;
  admins: number;
  rooms: number;
  activeRooms: number;
  questions: number;
  answers: number;
  messages: number;
}

export function AdminPanel({ user, onBack }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAll = async () => {
    try {
      const [uRes, sRes, rRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/rooms"),
      ]);
      if (uRes.ok) {
        const ud = await uRes.json();
        setUsers(ud.users ?? []);
      }
      if (sRes.ok) {
        const sd = await sRes.json();
        setStats(sd);
      }
      if (rRes.ok) {
        const rd = await rRes.json();
        setRooms(rd.rooms ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const toggleRole = async (u: AdminUser) => {
    setBusy(u.id);
    const newRole = u.role === "admin" ? "user" : "admin";
    try {
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u.username, role: newRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "تم التحديث", description: d.message });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)),
      );
      fetchAll();
    } catch (e: any) {
      toast({
        title: "تعذّر التحديث",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const deleteRoom = async (roomId: string, roomCode: string) => {
    if (!confirm(`هل أنت متأكد من حذف الغرفة ${roomCode}؟ لا يمكن التراجع.`)) return;
    setDeletingRoom(roomId);
    try {
      const res = await fetch("/api/admin/rooms/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "تم حذف الغرفة", description: `الغرفة ${roomCode} حُذفت` });
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      fetchAll();
    } catch (e: any) {
      toast({
        title: "تعذّر الحذف",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setDeletingRoom(null);
    }
  };

  const modeLabel = (m: string) =>
    m === "question_for_all" ? "جماعي" : "فردي";
  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      waiting: "انتظار",
      questioning: "أسئلة",
      answering: "إجابة",
      thinking: "تفكير",
      revealing: "كشف",
      chatting: "نقاش",
      finished: "منتهية",
    };
    return map[s] || s;
  };
  const statusColor = (s: string) => {
    if (s === "finished") return "text-muted-foreground";
    if (s === "waiting") return "text-sky-300";
    return "text-emerald-300";
  };

  return (
    <div className="relative min-h-screen bg-mystery-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl animate-float" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <motion.button
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للرئيسية
        </motion.button>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-primary/20 border border-amber-500/30">
              <Shield className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">لوحة الأدمن</h1>
              <p className="text-sm text-muted-foreground">
                مرحباً {user.username} — أدر المستخدمين والغرف
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            إحصائيات النظام
          </h2>
          {loading || !stats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-card/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<Users className="h-5 w-5" />} label="مستخدم" value={stats.users} color="from-blue-500/20 to-blue-700/10" />
              <StatCard icon={<Crown className="h-5 w-5" />} label="أدمن" value={stats.admins} color="from-amber-500/20 to-amber-700/10" />
              <StatCard icon={<Sparkles className="h-5 w-5" />} label="غرف نشطة" value={stats.activeRooms} color="from-emerald-500/20 to-emerald-700/10" />
              <StatCard icon={<MessageSquare className="h-5 w-5" />} label="رسائل" value={stats.messages} color="from-fuchsia-500/20 to-fuchsia-700/10" />
            </div>
          )}
        </motion.section>

        {/* Rooms management */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            إدارة الغرف
            <Badge variant="secondary" className="ml-auto">{rooms.length}</Badge>
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-card/40 animate-pulse" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <Card className="border-dashed border-border/50 bg-card/30">
              <CardContent className="py-10 text-center text-muted-foreground">
                <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
                لا توجد غرف
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto scroll-mystery">
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-3 backdrop-blur"
                >
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-10 w-12 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                      {r.roomCode.slice(0, 3)}{r.roomCode.slice(3)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{r.roomCode}</span>
                      <Badge variant="outline" className="text-[10px]">{modeLabel(r.gameMode)}</Badge>
                      <span className={cn("text-xs font-medium", statusColor(r.status))}>{statusLabel(r.status)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>{r.creatorAvatar} {r.creatorUsername}</span>
                      {" · "}
                      <span>{r.playersCount} لاعبين</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRoom(r.id, r.roomCode)}
                    disabled={deletingRoom === r.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {deletingRoom === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Users management */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Users className="h-4 w-4 text-primary" />
            إدارة المستخدمين
            <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-card/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto scroll-mystery">
              {users.map((u) => {
                const isAdmin = u.role === "admin";
                const isMe = u.id === user.id;
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-3 backdrop-blur",
                      isMe && "border-primary/60 bg-primary/5",
                    )}
                  >
                    <Avatar className="h-10 w-10 border border-border/60">
                      <AvatarFallback className="bg-secondary text-lg">{u.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.username}</span>
                        {isMe && <Badge variant="outline" className="text-[10px]">أنت</Badge>}
                        {isAdmin && (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px]">
                            <Crown className="ml-1 h-3 w-3" /> أدمن
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          try {
                            const d = new Date(u.created_at);
                            if (isNaN(d.getTime())) return "—";
                            return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
                          } catch { return "—"; }
                        })()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isAdmin ? "secondary" : "default"}
                      disabled={busy === u.id || isMe}
                      onClick={() => toggleRole(u)}
                      className="min-w-[120px]"
                    >
                      {busy === u.id ? (
                        <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                      ) : isAdmin ? (
                        <><UserMinus className="ml-1 h-4 w-4" /> إزالة الأدمن</>
                      ) : (
                        <><UserPlus className="ml-1 h-4 w-4" /> تعيين كأدمن</>
                      )}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className={cn("border-border/40 bg-gradient-to-br backdrop-blur", color)}>
      <CardContent className="p-4">
        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-background/40">{icon}</div>
        <div className="text-3xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
