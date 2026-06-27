import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser, generateAnonymousName } from "@/lib/auth";

const schema = z.object({ roomCode: z.string().length(6) });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "كود غير صالح" }, { status: 400 });

    const { roomCode } = parsed.data;
    const supabase = getSupabase();

    const { data: room, error } = await supabase
      .from("rooms")
      .select("id, room_code, game_mode, status")
      .eq("room_code", roomCode.toUpperCase())
      .maybeSingle();

    if (error || !room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    if (room.status === "finished") return NextResponse.json({ error: "هذه الغرفة منتهية" }, { status: 400 });

    const { data: existing } = await supabase
      .from("room_players")
      .select("id, anonymous_name")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        room: { id: room.id, roomCode: room.room_code, gameMode: room.game_mode, status: room.status },
        alreadyMember: true,
      });
    }

    const { data: players } = await supabase
      .from("room_players")
      .select("anonymous_name")
      .eq("room_id", room.id);

    const takenNames = (players ?? []).map((p) => p.anonymous_name);
    const anonymousName = generateAnonymousName(takenNames);

    const { error: insertError } = await supabase
      .from("room_players")
      .insert({ room_id: room.id, user_id: user.id, anonymous_name: anonymousName });

    if (insertError) return NextResponse.json({ error: "تعذّر الانضمام" }, { status: 500 });

    return NextResponse.json({
      room: { id: room.id, roomCode: room.room_code, gameMode: room.game_mode, status: room.status },
      anonymousName,
    });
  } catch (e) {
    console.error("[rooms/join]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
