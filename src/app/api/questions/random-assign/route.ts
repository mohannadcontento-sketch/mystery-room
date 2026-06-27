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
      .select("id, game_mode")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    if (room.game_mode !== "question_for_random") return NextResponse.json({ error: "هذه الميزة متاحة فقط في وضع السؤال لشخص عشوائي" }, { status: 400 });

    const { data: me } = await supabase
      .from("room_players")
      .select("id, user_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!me) return NextResponse.json({ error: "أنت لست عضواً في هذه الغرفة" }, { status: 403 });

    const { data: others } = await supabase
      .from("room_players")
      .select("id, anonymous_name")
      .eq("room_id", roomId)
      .neq("user_id", user.id);

    if (!others || others.length === 0) return NextResponse.json({ error: "لا يوجد لاعبون آخرون" }, { status: 400 });
    const target = others[Math.floor(Math.random() * others.length)];

    return NextResponse.json({
      target: { anonymousName: target.anonymous_name, playerId: target.id },
    });
  } catch (e) {
    console.error("[questions/random-assign]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
