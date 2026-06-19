/**
 * Mystery Room — Realtime Service (socket.io)
 *
 * Responsibilities:
 *   1. Broadcast room state transitions (waiting → answering → revealing → chatting → finished).
 *   2. Fan-out chat messages in real time (anonymized — server only stores anonymous_user).
 *   3. Fan-out new questions (sender identity stripped).
 *   4. Notify room members when answers arrive (counts only; full answers revealed by API).
 *   5. Notify room members when a player joins/leaves.
 *
 * The server is stateless across restarts: every event references a roomId and
 * the database is the single source of truth. We keep an in-memory index from
 * socketId → { roomId, userId } only for routing, never for game logic.
 */

import { createServer, Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

const PORT = 3003;

interface SocketSession {
  roomId: string;
  userId: string;
  anonymousName: string;
}

const sessions = new Map<string, SocketSession>();
const roomSockets = new Map<string, Set<string>>();

// Create HTTP server with explicit error handling
const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, connections: sessions.size }));
    return;
  }
  // Let socket.io handle everything else (it registers its own listeners)
  // If socket.io doesn't handle the request, return 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

// Catch ALL uncaught errors so the process never dies from a single bad request
httpServer.on("clientError", (err, socket) => {
  console.error("[mystery] clientError:", err.message);
  try {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  } catch {
    // ignore
  }
});

httpServer.on("error", (err) => {
  console.error("[mystery] httpServer error:", err);
});

const io = new Server(httpServer, {
  // Use the default /socket.io/ path — works with Next.js rewrite proxy.
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  // Destroy the socket on unhandled upgrade to avoid hanging connections
  destroyUpgrade: true,
  destroyUpgradeTimeout: 1000,
});

// Global error handlers — NEVER crash on a single error
process.on("uncaughtException", (err) => {
  console.error("[mystery] uncaughtException:", err?.message || err);
});
process.on("unhandledRejection", (err) => {
  console.error("[mystery] unhandledRejection:", err);
});

function joinRoom(socket: Socket, roomId: string) {
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId)!.add(socket.id);
  socket.join(`room:${roomId}`);
}

function leaveRoom(socket: Socket, roomId: string) {
  roomSockets.get(roomId)?.delete(socket.id);
  if (roomSockets.get(roomId)?.size === 0) roomSockets.delete(roomId);
  socket.leave(`room:${roomId}`);
}

io.on("connection", (socket) => {
  console.log(`[mystery] connect ${socket.id}`);

  socket.on("room:join", (payload: { roomId: string; userId: string; anonymousName: string }) => {
    if (!payload?.roomId || !payload?.userId || !payload?.anonymousName) return;
    // Only register the session if it's new (avoid duplicates from reconnects)
    if (sessions.has(socket.id)) return;
    sessions.set(socket.id, {
      roomId: payload.roomId,
      userId: payload.userId,
      anonymousName: payload.anonymousName,
    });
    joinRoom(socket, payload.roomId);

    // Notify others in the room that a new player joined (NOT self, to avoid loops)
    socket.to(`room:${payload.roomId}`).emit("player:joined", {
      anonymousName: payload.anonymousName,
    });

    // Tell OTHER clients (not self) to refresh their player list
    socket.to(`room:${payload.roomId}`).emit("room:refresh");
    console.log(`[mystery] ${payload.anonymousName} joined room ${payload.roomId}`);
  });

  socket.on("chat:send", (payload: { message: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    if (!payload?.message || typeof payload.message !== "string") return;
    const trimmed = payload.message.trim().slice(0, 500);
    if (!trimmed) return;

    // Broadcast to the room. We DO NOT send the userId; only the anonymous name.
    io.to(`room:${session.roomId}`).emit("chat:message", {
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      anonymousUser: session.anonymousName,
      message: trimmed,
      createdAt: new Date().toISOString(),
      // The sender's own client marks `mine: true` by comparing anonymousName.
    });
  });

  socket.on("question:new", (payload: { questionId: string; questionText: string; round: number; mode: string; targetPlayerId?: string | null }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    // Notify everyone in the room — sender identity stays hidden.
    io.to(`room:${session.roomId}`).emit("question:new", {
      questionId: payload.questionId,
      questionText: payload.questionText,
      round: payload.round,
      mode: payload.mode,
      // For random mode: only the targeted player should know they're the target.
      // We let the frontend decide — it checks if targetPlayerId matches their player id.
      targetPlayerId: payload.targetPlayerId ?? null,
    });
  });

  socket.on("answer:new", (payload: { questionId: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    // Just bump the answer count for everyone; the actual answer text is fetched via API at reveal time.
    io.to(`room:${session.roomId}`).emit("answer:count", {
      questionId: payload.questionId,
    });
  });

  socket.on("state:change", (payload: { status: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    io.to(`room:${session.roomId}`).emit("state:changed", {
      status: payload.status,
    });
  });

  socket.on("typing", (payload: { isTyping: boolean }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    socket.to(`room:${session.roomId}`).emit("typing", {
      anonymousName: session.anonymousName,
      isTyping: payload.isTyping,
    });
  });

  socket.on("disconnect", () => {
    const session = sessions.get(socket.id);
    if (session) {
      leaveRoom(socket, session.roomId);
      // Only notify OTHER clients (not the disconnecting one)
      socket.to(`room:${session.roomId}`).emit("player:left", {
        anonymousName: session.anonymousName,
      });
      socket.to(`room:${session.roomId}`).emit("room:refresh");
      console.log(`[mystery] ${session.anonymousName} left room ${session.roomId}`);
    }
    sessions.delete(socket.id);
    console.log(`[mystery] disconnect ${socket.id}`);
  });

  socket.on("error", (err) => {
    console.error(`[mystery] socket error ${socket.id}:`, err?.message || err);
    try { socket.disconnect(true); } catch {}
  });
});

// Catch engine-level errors (prevents process crash on bad WebSocket upgrades)
io.engine.on("connection_error", (err) => {
  console.error("[mystery] engine connection_error:", err?.message || err);
});

io.listen(PORT, () => {
  console.log(`[mystery] realtime service listening on :${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("[mystery] SIGTERM, closing...");
  io.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[mystery] SIGINT, closing...");
  io.close(() => process.exit(0));
});
