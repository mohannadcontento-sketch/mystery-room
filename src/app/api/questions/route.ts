import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  roomId: z.string(),
  questionText: z.string().min(3).max(280),
  targetPlayerId: z.string().optional(), // for question_for_random
});

/** Create a question (sender is hidden from other players). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { roomId, questionText, targetPlayerId } = parsed.data;

    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { players: true },
    });
    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }

    const me = room.players.find((p) => p.userId === user.id);
    if (!me) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }
    if (room.status !== "answering") {
      return NextResponse.json(
        { error: "غير مسموح بإنشاء سؤال في هذه المرحلة" },
        { status: 400 },
      );
    }

    // Determine round number
    const lastQuestion = await db.question.findFirst({
      where: { roomId },
      orderBy: { round: "desc" },
      select: { round: true },
    });
    const round = lastQuestion ? lastQuestion.round + 1 : 1;

    const question = await db.question.create({
      data: {
        roomId,
        senderId: user.id,
        targetId: targetPlayerId ?? null,
        questionText: questionText.trim(),
        mode: room.gameMode,
        round,
      },
      select: {
        id: true,
        questionText: true,
        round: true,
        mode: true,
        createdAt: true,
        targetId: true,
      },
    });

    // We NEVER return senderId — keep anonymity.
    return NextResponse.json({
      question: {
        id: question.id,
        questionText: question.questionText,
        round: question.round,
        mode: question.mode,
        createdAt: question.createdAt,
        // target is the room_player.id (not the user_id), used by frontend only for matching
        targetPlayerId: question.targetId,
      },
    });
  } catch (e) {
    console.error("[questions/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Get all questions for a room (sender_id hidden). */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) {
      return NextResponse.json({ error: "roomId مطلوب" }, { status: 400 });
    }

    const membership = await db.roomPlayer.findFirst({
      where: { roomId, userId: user.id },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    const questions = await db.question.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        questionText: true,
        round: true,
        mode: true,
        createdAt: true,
        targetId: true,
        // NOTE: senderId intentionally omitted
      },
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        round: q.round,
        mode: q.mode,
        createdAt: q.createdAt,
        // For random mode: hide target identity except from the assigned target.
        // The socket layer will mask this further if needed.
        targetPlayerId: q.targetId,
      })),
    });
  } catch (e) {
    console.error("[questions/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
