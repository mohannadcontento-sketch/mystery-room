import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

/**
 * Get the scores leaderboard for a room.
 * Returns each player's correct guess count for this room + their global score.
 */
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

    // Verify membership
    const { data: membership } = await supabase
      .from("room_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    // Get all players in the room with their profile info
    const { data: players, error: playersError } = await supabase
      .from("room_players")
      .select(
        "id, user_id, anonymous_name, joined_at, profiles!inner(id, username, avatar, total_score)",
      )
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    // For each player, count their correct guesses in this room
    const scores = [];
    for (const p of players ?? []) {
      const { count: correctInRoom } = await supabase
        .from("answer_guesses")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("guesser_id", p.user_id)
        .eq("is_correct", true);

      const { count: totalGuesses } = await supabase
        .from("answer_guesses")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("guesser_id", p.user_id);

      const profile = p.profiles as any;
      scores.push({
        playerId: p.id,
        userId: p.user_id,
        username: profile?.username ?? "مجهول",
        avatar: profile?.avatar ?? "❓",
        anonymousName: p.anonymous_name,
        correctGuesses: correctInRoom ?? 0,
        totalGuesses: totalGuesses ?? 0,
        globalScore: profile?.total_score ?? 0,
        isYou: p.user_id === user.id,
      });
    }

    // Sort by correct guesses (highest first)
    scores.sort((a, b) => b.correctGuesses - a.correctGuesses);

    // Find the winner (most correct guesses)
    const winner =
      scores.length > 0 && scores[0].correctGuesses > 0
        ? scores[0]
        : null;

    return NextResponse.json({
      scores,
      winner,
      myScore: scores.find((s) => s.isYou) ?? null,
    });
  } catch (e) {
    console.error("[scores]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
