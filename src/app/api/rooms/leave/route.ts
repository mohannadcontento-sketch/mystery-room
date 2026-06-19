import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ roomId: z.string() });

/** Returns room + players (with anonymous names only — real identities stay hidden). */
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

    const room = await db.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          orderBy: { joinedAt: "asc" },
        },
      },
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

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameMode: room.gameMode,
        status: room.status,
        creatorId: room.creatorId,
        createdAt: room.createdAt,
      },
      me: {
        anonymousName: me.anonymousName,
        joinedAt: me.joinedAt,
        isCreator: room.creatorId === user.id,
      },
      players: room.players.map((p) => ({
        // IMPORTANT: we never expose userId here, only the masked identity
        id: p.id,
        anonymousName: p.anonymousName,
        joinedAt: p.joinedAt,
        isYou: p.userId === user.id,
        isCreator: room.creatorId === p.userId,
      })),
      playersCount: room.players.length,
    });
  } catch (e) {
    console.error("[rooms/state]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Leave a room (removes the player record). */
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

    await db.roomPlayer.deleteMany({
      where: { roomId, userId: user.id },
    });

    // If room has no players left, mark it finished
    const remaining = await db.roomPlayer.count({ where: { roomId } });
    if (remaining === 0) {
      await db.room.update({
        where: { id: roomId },
        data: { status: "finished" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[rooms/leave]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
