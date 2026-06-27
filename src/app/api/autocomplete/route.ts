import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

// Pool of sentence starters for autocomplete battle (Arabic)
const PHRASES_AR = [
  "أجمل ذكرى لدي هي...",
  "لو كنت ممثلاً مشهوراً سأقوم بـ...",
  "أكثر شيء يخيفني هو...",
  "حلمي الذي لم أحققه بعد هو...",
  "لو حصلت على مليون دولار سأشتري...",
  "أسوأ عادة فيّ هي...",
  "أحب أن أتناول الإفطار مع...",
  "لو عشت في عالم خيالي سأكون...",
  "أكثر شخص أ Admirه هو...",
  "لو سافرت بالزمن سأذهب إلى...",
  "أفضل نصيحة سمعتها هي...",
  "لو كان لدي قوة خارقة سأختار...",
  "أكثر مكان يشعرني بالسلام هو...",
  "لو التقيت بنفسي الصغير سأقول له...",
  "أسوأ قرار اتخذته كان...",
  "أحب أن أقضي وقتي الحر في...",
  "لو ألغوا الإنترنت يوماً سأ...",
  "أكثر طبق أكرهه هو...",
  "لو كنت رئيساً سأبدأ بـ...",
  "أجمل صوت سمعته هو...",
  "لو فقدت ذاكرتي آخر شيء أريد تذكره...",
  "أكثر فيلم أثر فيّ هو...",
  "لو كانت حياتي فيلماً سيكون اسمه...",
  "أخاف من الأماكن التي...",
  "لو التقيت بملاك سيقول لي...",
  "أكثر أغنية تذكرني بطفولتي...",
  "لو كان لي لون واحد سأختار...",
  "أجمل هدية تلقيتها كانت...",
  "لو عشت مرة أخرى سأ...",
  "أكثر لحظة أحب تذكرها...",
];

const PHRASES_EN = [
  "The best memory I have is...",
  "If I were a famous actor I would...",
  "The scariest thing to me is...",
  "My unfulfilled dream is...",
  "If I got a million dollars I would buy...",
  "My worst habit is...",
  "I love having breakfast with...",
  "If I lived in a fantasy world I would be...",
  "The person I admire most is...",
  "If I time-traveled I would go to...",
];

/** Generate a random phrase for the room. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) return NextResponse.json({ error: "roomId مطلوب" }, { status: 400 });

    const supabase = getSupabase();

    // Verify membership
    const { data: membership } = await supabase
      .from("room_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "أنت لست عضواً" }, { status: 403 });

    // Get current autocomplete round (if any)
    const { data: currentRound } = await supabase
      .from("autocomplete_rounds")
      .select("id, phrase, round_number, time_limit, created_at")
      .eq("room_id", roomId)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get answers for this round (if revealing/chatting)
    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .maybeSingle();

    let answers: any[] = [];
    let myAnswer: any = null;

    if (currentRound && room && ["revealing", "chatting", "finished"].includes(room.status)) {
      const { data: ans } = await supabase
        .from("autocomplete_answers")
        .select("id, answer_text, used_voice, submitted_at, response_time_ms, user_id, profiles!autocomplete_answers_user_id_fkey(username, avatar)")
        .eq("round_id", currentRound.id)
        .order("submitted_at", { ascending: true });
      answers = (ans ?? []).map((a: any) => ({
        id: a.id,
        answerText: a.answer_text,
        usedVoice: a.used_voice,
        responseTimeMs: a.response_time_ms,
        username: a.profiles?.username,
        avatar: a.profiles?.avatar,
        isMine: a.user_id === user.id,
      }));
    } else if (currentRound) {
      // During answering — only show my own answer
      const { data: myAns } = await supabase
        .from("autocomplete_answers")
        .select("id, answer_text, used_voice, submitted_at, response_time_ms")
        .eq("round_id", currentRound.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (myAns) {
        myAnswer = {
          id: myAns.id,
          answerText: myAns.answer_text,
          usedVoice: myAns.used_voice,
          responseTimeMs: myAns.response_time_ms,
        };
      }

      // Count answers (for progress)
      const { count: answersCount } = await supabase
        .from("autocomplete_answers")
        .select("id", { count: "exact", head: true })
        .eq("round_id", currentRound.id);

      const { count: playersCount } = await supabase
        .from("room_players")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId);

      return NextResponse.json({
        round: currentRound
          ? {
              id: currentRound.id,
              phrase: currentRound.phrase,
              roundNumber: currentRound.round_number,
              timeLimit: currentRound.time_limit,
              createdAt: currentRound.created_at,
            }
          : null,
        myAnswer,
        answersCount: answersCount ?? 0,
        playersCount: playersCount ?? 0,
        revealed: false,
      });
    }

    return NextResponse.json({
      round: currentRound
        ? {
            id: currentRound.id,
            phrase: currentRound.phrase,
            roundNumber: currentRound.round_number,
            timeLimit: currentRound.time_limit,
            createdAt: currentRound.created_at,
          }
        : null,
      myAnswer: myAnswer,
      answers,
      revealed: true,
    });
  } catch (e) {
    console.error("[autocomplete/get]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Create a new autocomplete round (admin only). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json();
    const schema = z.object({
      roomId: z.string(),
      action: z.enum(["new_round", "submit_answer", "reveal"]),
      answerText: z.string().optional(),
      usedVoice: z.boolean().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

    const { roomId, action, answerText, usedVoice } = parsed.data;
    const supabase = getSupabase();

    // Verify membership
    const { data: membership } = await supabase
      .from("room_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "أنت لست عضواً" }, { status: 403 });

    if (action === "new_round") {
      // Only creator can create rounds
      const { data: room } = await supabase
        .from("rooms")
        .select("creator_id, status")
        .eq("id", roomId)
        .maybeSingle();
      if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
      if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط المنشئ" }, { status: 403 });

      // Get next round number
      const { data: lastRound } = await supabase
        .from("autocomplete_rounds")
        .select("round_number")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextRound = (lastRound?.round_number ?? 0) + 1;

      // Pick a random phrase
      const phrases = PHRASES_AR;
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];

      // Create the round
      const { data: newRound, error } = await supabase
        .from("autocomplete_rounds")
        .insert({
          room_id: roomId,
          round_number: nextRound,
          phrase,
          language: "ar",
          time_limit: 30,
        })
        .select("id, phrase, round_number, time_limit, created_at")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Set room status to answering
      await supabase.from("rooms").update({ status: "answering" }).eq("id", roomId);

      return NextResponse.json({ round: newRound });
    }

    if (action === "submit_answer") {
      if (!answerText || answerText.trim().length === 0) {
        return NextResponse.json({ error: "الإجابة فارغة" }, { status: 400 });
      }

      // Get current round
      const { data: currentRound } = await supabase
        .from("autocomplete_rounds")
        .select("id, created_at")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!currentRound) return NextResponse.json({ error: "لا توجد جولة نشطة" }, { status: 404 });

      // Check room status
      const { data: room } = await supabase
        .from("rooms")
        .select("status")
        .eq("id", roomId)
        .maybeSingle();
      if (!room || room.status !== "answering") {
        return NextResponse.json({ error: "انتهى وقت الإجابة" }, { status: 400 });
      }

      // Check if already answered
      const { data: existing } = await supabase
        .from("autocomplete_answers")
        .select("id")
        .eq("round_id", currentRound.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) return NextResponse.json({ error: "لقد أجبت بالفعل" }, { status: 400 });

      // Calculate response time
      const createdAt = new Date(currentRound.created_at).getTime();
      const responseTimeMs = Date.now() - createdAt;

      // Insert answer
      const { data: answer, error } = await supabase
        .from("autocomplete_answers")
        .insert({
          round_id: currentRound.id,
          user_id: user.id,
          answer_text: answerText.trim(),
          used_voice: usedVoice ?? false,
          response_time_ms: responseTimeMs,
        })
        .select("id, answer_text, used_voice, response_time_ms")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ answer });
    }

    if (action === "reveal") {
      // Only creator can reveal
      const { data: room } = await supabase
        .from("rooms")
        .select("creator_id")
        .eq("id", roomId)
        .maybeSingle();
      if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
      if (room.creator_id !== user.id) return NextResponse.json({ error: "فقط المنشئ" }, { status: 403 });

      await supabase.from("rooms").update({ status: "revealing" }).eq("id", roomId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("[autocomplete/post]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
