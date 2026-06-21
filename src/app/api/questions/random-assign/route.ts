import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  roomId: z.string(),
});

/**
 * For question_for_random mode: assigns each player a random target
 * (a derangement: no player targets themselves). Returns the assignment
 * ONLY for the requesting user — they only learn who they target,
 * never who targets them.
 */
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
    if (room.gameMode !== "question_for_random") {
      return NextResponse.json(
        { error: "هذه الميزة متاحة فقط في وضع السؤال لشخص عشوائي" },
        { status: 400 },
      );
    }

    const me = room.players.find((p) => p.userId === user.id);
    if (!me) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    // Pick a random other player in the room as the target.
    const others = room.players.filter((p) => p.userId !== user.id);
    if (others.length === 0) {
      return NextResponse.json(
        { error: "لا يوجد لاعبون آخرون" },
        { status: 400 },
      );
    }
    const target = others[Math.floor(Math.random() * others.length)];

    return NextResponse.json({
      target: {
        // Only return the anonymous identity, never the real user_id
        anonymousName: target.anonymousName,
        playerId: target.id,
      },
    });
  } catch (e) {
    console.error("[questions/random-assign]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
