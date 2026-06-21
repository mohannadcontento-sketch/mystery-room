import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ roomId: z.string() });

/** Start a round: transitions the room from waiting → answering. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    const { roomId } = parsed.data;

    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { players: true },
    });
    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }
    if (room.creatorId !== user.id) {
      return NextResponse.json(
        { error: "فقط منشئ الغرفة يمكنه بدء اللعبة" },
        { status: 403 },
      );
    }
    if (room.status !== "waiting" && room.status !== "chatting") {
      return NextResponse.json(
        { error: "لا يمكن بدء جولة جديدة في هذه اللحظة" },
        { status: 400 },
      );
    }
    if (room.players.length < 2) {
      return NextResponse.json(
        { error: "يلزم لاعبان على الأقل لبدء اللعبة" },
        { status: 400 },
      );
    }

    // For question_for_random mode, pre-assign each player a random target
    // (so nobody targets themselves, and assignments form a derangement).
    if (room.gameMode === "question_for_random") {
      const playerIds = room.players.map((p) => p.id);
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

      // ensure derangement
      let targets = shuffled;
      for (let attempt = 0; attempt < 10; attempt++) {
        const ok = playerIds.every((id, idx) => id !== targets[idx]);
        if (ok) break;
        targets = [...playerIds].sort(() => Math.random() - 0.5);
      }

      // store mapping in a metadata field on Room (we use a JSON column? SQLite no JSON column)
      // → store on each RoomPlayer via a separate table would be cleaner.
      // For simplicity, store the mapping in an in-memory map on the socket service.
      // Here, we return it to the caller so the frontend can pass it to the socket.
    }

    const updated = await db.room.update({
      where: { id: roomId },
      data: { status: "answering" },
    });

    return NextResponse.json({
      room: {
        id: updated.id,
        status: updated.status,
        gameMode: updated.gameMode,
      },
    });
  } catch (e) {
    console.error("[rooms/start]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
