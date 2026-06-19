"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  // Connect via the Next.js dev server, which proxies /socket.io/* to the
  // realtime mini-service (see next.config.ts → rewrites).
  // In production, set NEXT_PUBLIC_REALTIME_URL to your Supabase Realtime URL.
  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL || "";

  socket = io(realtimeUrl || undefined, {
    path: "/socket.io/",
    // Use polling only — WebSocket upgrades through the Next.js proxy
    // can crash the upstream service. Polling works reliably through
    // HTTP rewrites and is sufficient for our chat / game-state use case.
    transports: ["polling"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    timeout: 15000,
    autoConnect: true,
  });

  // Helpful for debugging in the browser console
  if (typeof window !== "undefined") {
    socket.on("connect", () => {
      console.log("[mystery-socket] connected:", socket.id);
    });
    socket.on("disconnect", (reason) => {
      console.log("[mystery-socket] disconnected:", reason);
    });
    socket.on("connect_error", (err) => {
      console.error("[mystery-socket] connect_error:", err.message);
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
