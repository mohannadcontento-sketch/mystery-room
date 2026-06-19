import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, generateAnonymousName } from "@/lib/auth";

const schema = z.object({
  roomCode: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "كود غير صالح" }, { status: 400 });
    }

    const { roomCode } = parsed.data;
    const room = await db.room.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: {
        players: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }

    if (room.status === "finished") {
      return NextResponse.json(
        { error: "هذه الغرفة منتهية" },
        { status: 400 },
      );
    }

    // Check if user is already in the room
    const existing = room.players.find((p) => p.userId === user.id);
    if (existing) {
      return NextResponse.json({
        room: {
          id: room.id,
          roomCode: room.roomCode,
          gameMode: room.gameMode,
          status: room.status,
        },
        alreadyMember: true,
      });
    }

    // Add user as a new player with a fresh anonymous identity
    const takenNames = room.players.map((p) => p.anonymousName);
    const anonymousName = generateAnonymousName(takenNames);

    await db.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: user.id,
        anonymousName,
      },
    });

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameMode: room.gameMode,
        status: room.status,
      },
      anonymousName,
    });
  } catch (e) {
    console.error("[rooms/join]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
