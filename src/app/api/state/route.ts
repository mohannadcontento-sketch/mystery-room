import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  roomId: z.string(),
  status: z.enum(["waiting", "questioning", "answering", "thinking", "revealing", "chatting", "finished"]),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    const { roomId, status } = parsed.data;
    const supabase = getSupabase();

    const { data: room } = await supabase
      .from("rooms")
      .select("id, creator_id, game_mode")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط منشئ الغرفة يمكنه تغيير الحالة" }, { status: 403 });

    const { error } = await supabase.from("rooms").update({ status }).eq("id", roomId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // When entering "finished", reset all players' ready_at
    if (status === "finished") {
      await supabase.from("room_players").update({ ready_at: null }).eq("room_id", roomId);
    }

    return NextResponse.json({ room: { id: roomId, status, gameMode: room.game_mode } });
  } catch (e) {
    console.error("[state/update]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
