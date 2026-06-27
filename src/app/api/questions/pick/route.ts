import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ roomId: z.string() });

/** Creator manually picks a random question from the pool and transitions to answering. */
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
    if (room.status !== "questioning") return NextResponse.json({ error: "يجب أن تكون في مرحلة كتابة الأسئلة" }, { status: 400 });

    // Get pending questions
    const { data: pending } = await supabase
      .from("questions")
      .select("id")
      .eq("room_id", roomId)
      .eq("round", 0);

    if (!pending || pending.length === 0) {
      return NextResponse.json({ error: "لا توجد أسئلة متاحة للاختيار" }, { status: 400 });
    }

    // Pick random
    const picked = pending[Math.floor(Math.random() * pending.length)];

    // Get next round number
    const { data: used } = await supabase
      .from("questions")
      .select("round")
      .eq("room_id", roomId)
      .gt("round", 0)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRound = (used?.round ?? 0) + 1;

    // Assign round to picked question
    await supabase.from("questions").update({ round: nextRound }).eq("id", picked.id);

    // Transition to answering
    await supabase.from("rooms").update({ status: "answering" }).eq("id", roomId);

    return NextResponse.json({ ok: true, pickedQuestionId: picked.id, round: nextRound });
  } catch (e) {
    console.error("[questions/pick]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
