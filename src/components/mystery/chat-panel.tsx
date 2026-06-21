"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { usePolling } from "@/hooks/use-polling";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  roomId: string;
  anonymousName: string;
  enabled?: boolean;
  className?: string;
  compact?: boolean;
}

interface MessagesResponse {
  messages: ChatMessage[];
}

export function ChatPanel({
  roomId,
  anonymousName,
  enabled = true,
  className,
  compact,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?roomId=${roomId}`);
    if (!res.ok) throw new Error("fetch failed");
    const data: MessagesResponse = await res.json();
    return data;
  }, [roomId]);

  const { data } = usePolling<MessagesResponse>({
    fetcher: fetchMessages,
    intervalMs: 1000,
  });

  // Merge polled messages with local optimistic ones
  useEffect(() => {
    if (!data?.messages) return;
    // Replace local state with server state, but keep any optimistic messages
    // that haven't been confirmed yet (within a 5s window).
    setLocalMessages((prev) => {
      const now = Date.now();
      const recentOptimistic = prev.filter(
        (m) =>
          m.id.startsWith("opt_") &&
          now - new Date(m.createdAt).getTime() < 5000 &&
          !data.messages.some(
            (s) =>
              s.anonymousUser === m.anonymousUser &&
              s.message === m.message &&
              Math.abs(
                new Date(s.createdAt).getTime() -
                  new Date(m.createdAt).getTime(),
              ) < 3000,
          ),
      );
      return [...data.messages, ...recentOptimistic].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, [data]);

  // Track latest message for sound/notification
  useEffect(() => {
    if (!data?.messages?.length) return;
    const last = data.messages[data.messages.length - 1];
    if (
      lastMessageIdRef.current &&
      lastMessageIdRef.current !== last.id &&
      last.anonymousUser !== anonymousName
    ) {
      // A new message from someone else arrived — could play a sound here.
    }
    lastMessageIdRef.current = last.id;
  }, [data?.messages, anonymousName]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (el) el.scrollTop = el.scrollHeight;
  }, [localMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !enabled) return;
    setSending(true);

    // Optimistic: add to local immediately
    const optimistic: ChatMessage = {
      id: `opt_${Date.now()}`,
      anonymousUser: anonymousName,
      message: text,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    setLocalMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, message: text }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "تعذّر الإرسال");
      }
    } catch (e: any) {
      toast({
        title: "تعذّر الإرسال",
        description: e?.message,
        variant: "destructive",
      });
      // Remove the optimistic message
      setLocalMessages((prev) =>
        prev.filter((m) => m.id !== optimistic.id),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/50 backdrop-blur",
        compact ? "h-full" : "h-[400px]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">شات الغرفة</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          مباشر
        </span>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 scroll-mystery">
        <div className="space-y-2 p-3">
          {localMessages.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-6 w-6 opacity-40" />
              لا توجد رسائل بعد. ابدأ النقاش!
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {localMessages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex flex-col gap-1",
                    m.mine ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.mine
                        ? "bg-primary text-primary-foreground rounded-bl-md"
                        : "bg-secondary text-secondary-foreground rounded-br-md",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-0.5 text-[10px] font-medium opacity-70",
                        m.mine ? "text-primary-foreground" : "text-primary",
                      )}
                    >
                      {m.mine ? "أنت" : m.anonymousUser}
                    </div>
                    <div className="whitespace-pre-wrap break-words">
                      {m.message}
                    </div>
                  </div>
                  <div className="px-2 text-[10px] text-muted-foreground">
                    {formatTime(m.createdAt)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t border-border/40 p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={enabled ? "اكتب رسالة مجهولة..." : "الشات غير متاح الآن"}
          disabled={!enabled || sending}
          className="bg-background/60"
          maxLength={500}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sending || !enabled}
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
