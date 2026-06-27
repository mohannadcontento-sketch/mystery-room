import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ roomId: z.string() });

/** Returns room + players (with real usernames + avatars). */
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

    const supabase = getSupabase();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, room_code, creator_id, game_mode, status, created_at, real_names_enabled")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }

    // Get players with their profile info (real username + avatar)
    const { data: players, error: playersError } = await supabase
      .from("room_players")
      .select(
        "id, anonymous_name, joined_at, user_id, ready_at, profiles!room_players_user_id_fkey(username, avatar)",
      )
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    const me = (players ?? []).find((p) => p.user_id === user.id);
    if (!me) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    const playersList = players ?? [];
    const readyCount = playersList.filter((p) => p.ready_at).length;
    const allReady =
      playersList.length >= 2 && readyCount === playersList.length;

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.room_code,
        gameMode: room.game_mode,
        status: room.status,
        creatorId: room.creator_id,
        createdAt: room.created_at,
        realNamesEnabled: room.real_names_enabled,
      },
      me: {
        anonymousName: me.anonymous_name,
        joinedAt: me.joined_at,
        isCreator: room.creator_id === user.id,
        playerId: me.id,
        readyAt: me.ready_at,
        isReady: !!me.ready_at,
        username: user.username,
        avatar: user.avatar,
      },
      players: playersList.map((p) => {
        const profile = p.profiles as any;
        return {
          id: p.id,
          anonymousName: p.anonymous_name,
          // Real username + avatar (now visible to all players)
          username: profile?.username ?? "مجهول",
          avatar: profile?.avatar ?? "❓",
          userId: p.user_id,
          joinedAt: p.joined_at,
          readyAt: p.ready_at,
          isReady: !!p.ready_at,
          isYou: p.user_id === user.id,
          isCreator: room.creator_id === p.user_id,
        };
      }),
      playersCount: playersList.length,
      readyCount,
      allReady,
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
    const supabase = getSupabase();

    const { error } = await supabase
      .from("room_players")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If room has no players left, mark it finished
    const { count } = await supabase
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId);

    if ((count ?? 0) === 0) {
      await supabase
        .from("rooms")
        .update({ status: "finished" })
        .eq("id", roomId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[rooms/leave]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
