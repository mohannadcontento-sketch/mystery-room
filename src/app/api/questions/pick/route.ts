import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ roomId: z.string() });

/** Pick the NEXT pending question (in order) and assign it a round number.
 *  Returns info about how many questions remain. */
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
    if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط المنشئ يمكنه اختيار السؤال" }, { status: 403 });

    // Get pending questions (round=0), ordered by creation time (first written = first shown)
    const { data: pending } = await supabase
      .from("questions")
      .select("id, question_text, created_at")
      .eq("room_id", roomId)
      .eq("round", 0)
      .order("created_at", { ascending: true });

    if (!pending || pending.length === 0) {
      // No more questions — go to chatting
      await supabase.from("rooms").update({ status: "chatting" }).eq("id", roomId);
      return NextResponse.json({ ok: true, noMoreQuestions: true, status: "chatting" });
    }

    // Pick the FIRST pending question (not random — sequential)
    const picked = pending[0];

    // Get the max round used so far
    const { data: used } = await supabase
      .from("questions")
      .select("round")
      .eq("room_id", roomId)
      .gt("round", 0)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRound = (used?.round ?? 0) + 1;

    // Assign the round number to the picked question
    await supabase.from("questions").update({ round: nextRound }).eq("id", picked.id);

    // Transition to answering
    await supabase.from("rooms").update({ status: "answering" }).eq("id", roomId);

    return NextResponse.json({
      ok: true,
      pickedQuestionId: picked.id,
      pickedQuestionText: picked.question_text,
      round: nextRound,
      remainingQuestions: pending.length - 1,
      status: "answering",
    });
  } catch (e) {
    console.error("[questions/pick]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
