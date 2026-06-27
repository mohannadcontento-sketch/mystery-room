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

          // For question_for_all: start with "questioning" phase
          // For question_for_random: start with "answering" phase
          // Check if there are pending questions (round=0) to pick from
          const { data: roomData } = await supabase
            .from("rooms")
            .select("game_mode")
            .eq("id", roomId)
            .maybeSingle();

          let nextStatus = "answering";
          if (roomData?.game_mode === "question_for_all") {
            // Check if there are already pending questions (from a previous questioning phase)
            const { count: pendingCount } = await supabase
              .from("questions")
              .select("id", { count: "exact", head: true })
              .eq("room_id", roomId)
              .eq("round", 0);

            if ((pendingCount ?? 0) > 0) {
              // There are pending questions — pick one and go to answering
              const { data: pending } = await supabase
                .from("questions")
                .select("id")
                .eq("room_id", roomId)
                .eq("round", 0);

              if (pending && pending.length > 0) {
                const picked = pending[Math.floor(Math.random() * pending.length)];
                const { data: used } = await supabase
                  .from("questions")
                  .select("round")
                  .eq("room_id", roomId)
                  .gt("round", 0)
                  .order("round", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                const nextRound = (used?.round ?? 0) + 1;
                await supabase.from("questions").update({ round: nextRound }).eq("id", picked.id);
                nextStatus = "answering";
              }
            } else {
              // No pending questions — go to questioning phase
              nextStatus = "questioning";
            }
          }

          await supabase
            .from("rooms")
            .update({ status: nextStatus })
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
