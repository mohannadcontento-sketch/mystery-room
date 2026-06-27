import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ roomId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    const { roomId } = parsed.data;
    const supabase = getSupabase();

    const { data: room } = await supabase
      .from("rooms")
      .select("id, creator_id, status, game_mode")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط منشئ الغرفة يمكنه بدء اللعبة" }, { status: 403 });
    if (room.status !== "waiting" && room.status !== "chatting") return NextResponse.json({ error: "لا يمكن بدء جولة جديدة" }, { status: 400 });

    const { count } = await supabase
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId);

    if ((count ?? 0) < 2) return NextResponse.json({ error: "يلزم لاعبان على الأقل" }, { status: 400 });

    await supabase.from("room_players").update({ ready_at: null }).eq("room_id", roomId);
    const { error: updateError } = await supabase.from("rooms").update({ status: "answering" }).eq("id", roomId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ room: { id: roomId, status: "answering", gameMode: room.game_mode } });
  } catch (e) {
    console.error("[rooms/start]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
