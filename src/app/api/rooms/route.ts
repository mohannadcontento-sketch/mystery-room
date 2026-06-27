import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
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
    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "فقط الأدمن يمكنه إنشاء غرف جديدة" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "وضع اللعبة غير صالح" }, { status: 400 });
    }

    const { gameMode } = parsed.data;
    const supabase = getSupabase();

    let roomCode = "";
    for (let i = 0; i < 5; i++) {
      const candidate = generateRoomCode();
      const { data: exists } = await supabase
        .from("rooms")
        .select("id")
        .eq("room_code", candidate)
        .maybeSingle();
      if (!exists) { roomCode = candidate; break; }
    }
    if (!roomCode) {
      return NextResponse.json({ error: "فشل توليد كود الغرفة" }, { status: 500 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ room_code: roomCode, creator_id: user.id, game_mode: gameMode, status: "waiting" })
      .select("id, room_code, game_mode, status")
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "فشل إنشاء الغرفة" }, { status: 500 });
    }

    await supabase.from("room_players").insert({
      room_id: room.id,
      user_id: user.id,
      anonymous_name: generateAnonymousName([]),
    });

    return NextResponse.json({
      room: { id: room.id, roomCode: room.room_code, gameMode: room.game_mode, status: room.status },
    });
  } catch (e) {
    console.error("[rooms/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const supabase = getSupabase();
    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("id, room_code, game_mode, status, created_at")
      .in("status", ["waiting", "answering", "thinking", "revealing", "chatting"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const roomsWithCount = await Promise.all(
      (rooms ?? []).map(async (r) => {
        const { count } = await supabase
          .from("room_players")
          .select("id", { count: "exact", head: true })
          .eq("room_id", r.id);
        return {
          id: r.id,
          roomCode: r.room_code,
          gameMode: r.game_mode,
          status: r.status,
          playersCount: count ?? 0,
          createdAt: r.created_at,
        };
      }),
    );

    return NextResponse.json({ rooms: roomsWithCount });
  } catch (e) {
    console.error("[rooms/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
