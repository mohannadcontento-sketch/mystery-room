import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

// Arabic letters for the game (excluding difficult letters)
const LETTERS = ["أ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي"];

const CATEGORIES = ["boy_name","girl_name","animal","country","plant"] as const;
const CATEGORY_LABELS: Record<string,string> = {
  boy_name: "ولد",
  girl_name: "بنت",
  animal: "حيوان",
  country: "بلاد",
  plant: "نبات",
};

const submitSchema = z.object({
  roomId: z.string(),
  action: z.enum(["new_round","submit_answer","reveal","correct"]),
  answers: z.object({
    boy_name: z.string(),
    girl_name: z.string(),
    animal: z.string(),
    country: z.string(),
    plant: z.string(),
  }).optional(),
  usedVoice: z.boolean().optional(),
  answerId: z.string().optional(),
  score: z.number().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) return NextResponse.json({ error: "roomId مطلوب" }, { status: 400 });

    const supabase = getSupabase();

    const { data: membership } = await supabase
      .from("room_players").select("id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "أنت لست عضواً" }, { status: 403 });

    const { data: room } = await supabase.from("rooms").select("status, creator_id").eq("id", roomId).maybeSingle();
    if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });

    // Get current round
    const { data: round } = await supabase
      .from("autocomplete_rounds")
      .select("id, letter, round_number, time_limit, created_at")
      .eq("room_id", roomId).order("round_number",{ascending:false}).limit(1).maybeSingle();

    let myAnswer: any = null;
    let allAnswers: any[] = [];
    let answersCount = 0;
    let playersCount = 0;

    const { count: pc } = await supabase.from("room_players").select("id",{count:"exact",head:true}).eq("room_id",roomId);
    playersCount = pc ?? 0;

    if (round) {
      // My answer
      const { data: myAns } = await supabase
        .from("autocomplete_answers")
        .select("id, boy_name, girl_name, animal, country, plant, used_voice, response_time_ms, score, corrected, submitted_at")
        .eq("round_id", round.id).eq("user_id", user.id).maybeSingle();
      myAnswer = myAns;

      const { count: ac } = await supabase.from("autocomplete_answers").select("id",{count:"exact",head:true}).eq("round_id", round.id);
      answersCount = ac ?? 0;

      // During revealing/chatting — show all answers with player names
      if (["revealing","chatting","finished"].includes(room.status)) {
        const { data: ans } = await supabase
          .from("autocomplete_answers")
          .select("id, boy_name, girl_name, animal, country, plant, used_voice, response_time_ms, score, corrected, user_id, profiles!autocomplete_answers_user_id_fkey(username, avatar)")
          .eq("round_id", round.id).order("submitted_at",{ascending:true});
        allAnswers = (ans ?? []).map((a: any) => ({
          id: a.id,
          boyName: a.boy_name, girlName: a.girl_name, animal: a.animal, country: a.country, plant: a.plant,
          usedVoice: a.used_voice, responseTimeMs: a.response_time_ms, score: a.score, corrected: a.corrected,
          username: a.profiles?.username, avatar: a.profiles?.avatar, isMine: a.user_id === user.id,
        }));
      }
    }

    return NextResponse.json({
      round: round ? { id: round.id, letter: round.letter, roundNumber: round.round_number, timeLimit: round.time_limit, createdAt: round.created_at } : null,
      myAnswer,
      allAnswers,
      answersCount,
      playersCount,
      roomStatus: room.status,
      isCreator: room.creator_id === user.id,
      categoryLabels: CATEGORY_LABELS,
    });
  } catch (e) {
    console.error("[autocomplete/get]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

    const { roomId, action, answers, usedVoice, answerId, score } = parsed.data;
    const supabase = getSupabase();

    const { data: membership } = await supabase.from("room_players").select("id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "أنت لست عضواً" }, { status: 403 });

    const { data: room } = await supabase.from("rooms").select("creator_id, status").eq("id", roomId).maybeSingle();
    if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });

    if (action === "new_round") {
      if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط المنشئ" }, { status: 403 });
      const { data: lastRound } = await supabase.from("autocomplete_rounds").select("round_number").eq("room_id", roomId).order("round_number",{ascending:false}).limit(1).maybeSingle();
      const nextRound = (lastRound?.round_number ?? 0) + 1;
      const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];

      const { data: newRound, error } = await supabase.from("autocomplete_rounds").insert({ room_id: roomId, round_number: nextRound, letter, time_limit: 60 }).select("id, letter, round_number, time_limit, created_at").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await supabase.from("rooms").update({ status: "answering" }).eq("id", roomId);
      return NextResponse.json({ round: newRound });
    }

    if (action === "submit_answer") {
      if (!answers) return NextResponse.json({ error: "الإجابات مطلوبة" }, { status: 400 });
      const { data: round } = await supabase.from("autocomplete_rounds").select("id, created_at").eq("room_id", roomId).order("round_number",{ascending:false}).limit(1).maybeSingle();
      if (!round) return NextResponse.json({ error: "لا توجد جولة نشطة" }, { status: 404 });
      if (room.status !== "answering") return NextResponse.json({ error: "انتهى الوقت" }, { status: 400 });

      const { data: existing } = await supabase.from("autocomplete_answers").select("id").eq("round_id", round.id).eq("user_id", user.id).maybeSingle();
      if (existing) return NextResponse.json({ error: "أجبت بالفعل" }, { status: 400 });

      const responseTimeMs = Date.now() - new Date(round.created_at).getTime();
      const { data: ans, error } = await supabase.from("autocomplete_answers").insert({
        round_id: round.id, user_id: user.id,
        boy_name: answers.boy_name.trim(), girl_name: answers.girl_name.trim(),
        animal: answers.animal.trim(), country: answers.country.trim(), plant: answers.plant.trim(),
        used_voice: usedVoice ?? false, response_time_ms: responseTimeMs, score: 0, corrected: false,
      }).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ answer: ans });
    }

    if (action === "reveal") {
      if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط المنشئ" }, { status: 403 });
      await supabase.from("rooms").update({ status: "revealing" }).eq("id", roomId);
      return NextResponse.json({ ok: true });
    }

    if (action === "correct") {
      if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط المنشئ يصحح" }, { status: 403 });
      if (!answerId || score === undefined) return NextResponse.json({ error: "answerId و score مطلوبان" }, { status: 400 });
      const { error } = await supabase.from("autocomplete_answers").update({ score, corrected: true }).eq("id", answerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("[autocomplete/post]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
