import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  questionId: z.string(),
  answerText: z.string().min(1).max(500),
});

/** Submit an answer for a question (userId is hidden from other players). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { questionId, answerText } = parsed.data;

    const question = await db.question.findUnique({
      where: { id: questionId },
      include: { room: true },
    });
    if (!question) {
      return NextResponse.json({ error: "السؤال غير موجود" }, { status: 404 });
    }
    if (question.room.status !== "answering") {
      return NextResponse.json(
        { error: "غير مسموح بالإجابة في هذه المرحلة" },
        { status: 400 },
      );
    }

    // Prevent double-answering
    const existing = await db.answer.findUnique({
      where: {
        questionId_userId: { questionId, userId: user.id },
      },
      select: { id: true },
    }).catch(() => null);

    if (existing) {
      return NextResponse.json(
        { error: "لقد أجبت على هذا السؤال بالفعل" },
        { status: 400 },
      );
    }

    const answer = await db.answer.create({
      data: {
        questionId,
        userId: user.id,
        answerText: answerText.trim(),
      },
      select: {
        id: true,
        answerText: true,
        createdAt: true,
      },
    });

    // IMPORTANT: we never return userId
    return NextResponse.json({ answer });
  } catch (e) {
    console.error("[answers/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Get all answers for a question — only callable when room is revealing/chatting. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get("questionId");
    if (!questionId) {
      return NextResponse.json(
        { error: "questionId مطلوب" },
        { status: 400 },
      );
    }

    const question = await db.question.findUnique({
      where: { id: questionId },
      include: { room: { include: { players: true } } },
    });
    if (!question) {
      return NextResponse.json({ error: "السؤال غير موجود" }, { status: 404 });
    }

    const me = question.room.players.find((p) => p.userId === user.id);
    if (!me) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    // Only allow fetching answers when room is revealing or chatting or finished
    if (!["revealing", "chatting", "finished"].includes(question.room.status)) {
      // While answering, just return count (no text)
      const count = await db.answer.count({ where: { questionId } });
      return NextResponse.json({
        answers: [],
        count,
        revealed: false,
      });
    }

    const answers = await db.answer.findMany({
      where: { questionId },
      orderBy: { createdAt: "asc" },
      // NOTE: userId intentionally omitted
      select: {
        id: true,
        answerText: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      answers,
      count: answers.length,
      revealed: true,
    });
  } catch (e) {
    console.error("[answers/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
