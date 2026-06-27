import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

/** List all rooms with player counts — admin only. */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "فقط الأدمن يمكنه عرض الغرف" },
        { status: 403 },
      );
    }

    const supabase = getSupabase();

    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("id, room_code, game_mode, status, created_at, creator_id, profiles!rooms_creator_id_fkey(username, avatar)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get player count for each room
    const roomsWithCount = await Promise.all(
      (rooms ?? []).map(async (r) => {
        const { count } = await supabase
          .from("room_players")
          .select("id", { count: "exact", head: true })
          .eq("room_id", r.id);
        const creator = r.profiles as any;
        return {
          id: r.id,
          roomCode: r.room_code,
          gameMode: r.game_mode,
          status: r.status,
          createdAt: r.created_at,
          creatorId: r.creator_id,
          creatorUsername: creator?.username ?? "مجهول",
          creatorAvatar: creator?.avatar ?? "❓",
          playersCount: count ?? 0,
        };
      }),
    );

    return NextResponse.json({ rooms: roomsWithCount });
  } catch (e) {
    console.error("[admin/rooms]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
