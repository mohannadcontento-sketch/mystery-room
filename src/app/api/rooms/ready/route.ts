import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  roomId: z.string(),
  ready: z.boolean(),
});

/** Toggle ready state for the current player in a room. */
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
    const { roomId, ready } = parsed.data;
    const supabase = getSupabase();

    // Verify membership
    const { data: membership } = await supabase
      .from("room_players")
      .select("id, anonymous_name")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    // Update ready_at
    const { error } = await supabase
      .from("room_players")
      .update({ ready_at: ready ? new Date().toISOString() : null })
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if everyone is ready — if so, auto-start the round.
    let autoStarted = false;
    if (ready) {
      const { data: room } = await supabase
        .from("rooms")
        .select("id, status")
        .eq("id", roomId)
        .maybeSingle();

      if (room && (room.status === "waiting" || room.status === "chatting" || room.status === "finished")) {
        const { data: players } = await supabase
          .from("room_players")
          .select("id, ready_at")
          .eq("room_id", roomId);

        const playerCount = players?.length ?? 0;
        const readyCount = (players ?? []).filter((p) => p.ready_at).length;

        if (playerCount >= 2 && readyCount === playerCount) {
          // Reset ready_at for all players (fresh state for next round)
          await supabase
            .from("room_players")
            .update({ ready_at: null })
            .eq("room_id", roomId);

          // Transition to answering
          await supabase
            .from("rooms")
            .update({ status: "answering" })
            .eq("id", roomId);

          autoStarted = true;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      ready,
      anonymousName: membership.anonymous_name,
      autoStarted,
    });
  } catch (e) {
    console.error("[rooms/ready]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
