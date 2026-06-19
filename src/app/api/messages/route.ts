import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  roomId: z.string(),
  message: z.string().min(1).max(500),
});

/** Persist a chat message — uses the player's anonymous name, never the real identity. */
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
        { error: "بيانات غير صالحة" },
        { status: 400 },
      );
    }
    const { roomId, message } = parsed.data;

    const membership = await db.roomPlayer.findFirst({
      where: { roomId, userId: user.id },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    // Make sure the room is in chatting/revealing state
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { status: true },
    });
    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }
    if (!["chatting", "revealing", "answering", "waiting"].includes(room.status)) {
      return NextResponse.json(
        { error: "الشات غير متاح في هذه المرحلة" },
        { status: 400 },
      );
    }

    const msg = await db.message.create({
      data: {
        roomId,
        anonymousUser: membership.anonymousName,
        message: message.trim(),
      },
    });

    return NextResponse.json({
      message: {
        id: msg.id,
        anonymousUser: msg.anonymousUser,
        message: msg.message,
        createdAt: msg.createdAt,
        mine: true,
      },
    });
  } catch (e) {
    console.error("[messages/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** List all chat messages for a room. */
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

    const messages = await db.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        anonymousUser: m.anonymousUser,
        message: m.message,
        createdAt: m.createdAt,
        mine: m.anonymousUser === membership.anonymousName,
      })),
    });
  } catch (e) {
    console.error("[messages/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
