import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, generateAnonymousName, generateRoomCode } from "@/lib/auth";

const createSchema = z.object({
  gameMode: z.enum(["question_for_all", "question_for_random"]),
});

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
        { error: "وضع اللعبة غير صالح" },
        { status: 400 },
      );
    }

    const { gameMode } = parsed.data;

    // generate a unique code (retry up to 5 times)
    let roomCode = "";
    for (let i = 0; i < 5; i++) {
      const candidate = generateRoomCode();
      const exists = await db.room.findUnique({
        where: { roomCode: candidate },
        select: { id: true },
      });
      if (!exists) {
        roomCode = candidate;
        break;
      }
    }
    if (!roomCode) {
      return NextResponse.json(
        { error: "فشل توليد كود الغرفة" },
        { status: 500 },
      );
    }

    const room = await db.room.create({
      data: {
        roomCode,
        creatorId: user.id,
        gameMode,
        status: "waiting",
        players: {
          create: {
            userId: user.id,
            anonymousName: generateAnonymousName([]),
          },
        },
      },
      include: {
        players: true,
      },
    });

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameMode: room.gameMode,
        status: room.status,
      },
    });
  } catch (e) {
    console.error("[rooms/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // Return all currently active rooms (waiting status), newest first
    const rooms = await db.room.findMany({
      where: {
        status: { in: ["waiting", "answering", "revealing", "chatting"] },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        _count: { select: { players: true } },
      },
    });

    return NextResponse.json({
      rooms: rooms.map((r) => ({
        id: r.id,
        roomCode: r.roomCode,
        gameMode: r.gameMode,
        status: r.status,
        playersCount: r._count.players,
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    console.error("[rooms/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
