import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  roomId: z.string(),
  status: z.enum(["waiting", "answering", "revealing", "chatting", "finished"]),
});

/** Transition the room to a new state. Only the room creator can do this. */
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
    const { roomId, status } = parsed.data;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }
    if (room.creatorId !== user.id) {
      return NextResponse.json(
        { error: "فقط منشئ الغرفة يمكنه تغيير الحالة" },
        { status: 403 },
      );
    }

    const updated = await db.room.update({
      where: { id: roomId },
      data: { status },
      select: { id: true, status: true, gameMode: true },
    });

    return NextResponse.json({ room: updated });
  } catch (e) {
    console.error("[state/update]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
