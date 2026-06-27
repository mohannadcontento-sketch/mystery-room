import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  roomId: z.string(),
  questionText: z.string().min(3).max(280),
  targetPlayerId: z.string().optional(),
});

/** Pick a random question from the pool (round=0) and assign it a round number. */
async function pickRandomQuestion(supabase: any, roomId: string): Promise<string | null> {
  // Get all pending questions (round = 0)
  const { data: pending } = await supabase
    .from("questions")
    .select("id")
    .eq("room_id", roomId)
    .eq("round", 0);

  if (!pending || pending.length === 0) return null;

  // Pick a random one
  const picked = pending[Math.floor(Math.random() * pending.length)];

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
  await supabase
    .from("questions")
    .update({ round: nextRound })
    .eq("id", picked.id);

  return picked.id;
}

/** Create a question. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات غير صالحة" },
        { status: 400 },
      );
    }
    const { roomId, questionText, targetPlayerId } = parsed.data;
    const supabase = getSupabase();

    const { data: room } = await supabase
      .from("rooms")
      .select("id, status, game_mode")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }

    const { data: me } = await supabase
      .from("room_players")
      .select("id, user_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!me) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    // === GROUP MODE (question_for_all) ===
    // Questions are written during "questioning" phase (one per player, round=0)
    if (room.game_mode === "question_for_all") {
      if (room.status !== "questioning") {
        return NextResponse.json(
          { error: "كتابة الأسئلة متاحة فقط في مرحلة 'كتابة الأسئلة'" },
          { status: 400 },
        );
      }

      // Check if this player already submitted a question this round (round=0)
      const { data: existing } = await supabase
        .from("questions")
        .select("id")
        .eq("room_id", roomId)
        .eq("sender_id", user.id)
        .eq("round", 0)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "لقد كتبت سؤالك بالفعل. انتظر باقي اللاعبين" },
          { status: 400 },
        );
      }

      // Insert the question with round=0 (pending)
      const { data: question, error } = await supabase
        .from("questions")
        .insert({
          room_id: roomId,
          sender_id: user.id,
          target_id: null,
          question_text: questionText.trim(),
          mode: room.game_mode,
          round: 0,
        })
        .select("id, question_text, round, mode, created_at")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Check if ALL players have submitted a question
      const { count: playerCount } = await supabase
        .from("room_players")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId);

      const { count: questionCount } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("round", 0);

      let autoPicked = false;
      if (questionCount >= playerCount && playerCount >= 2) {
        // Everyone submitted — auto-pick a random question
        await pickRandomQuestion(supabase, roomId);
        await supabase.from("rooms").update({ status: "answering" }).eq("id", roomId);
        autoPicked = true;
      }

      return NextResponse.json({
        question: {
          id: question.id,
          questionText: question.question_text,
          round: question.round,
          mode: question.mode,
        },
        autoPicked,
        pendingCount: questionCount,
        playerCount,
      });
    }

    // === RANDOM MODE (question_for_random) ===
    // Questions are written during "answering" phase (targeted to a specific player)
    if (room.game_mode === "question_for_random") {
      if (room.status !== "answering") {
        return NextResponse.json(
          { error: "غير مسموح بإنشاء سؤال في هذه المرحلة" },
          { status: 400 },
        );
      }

      let targetUserId: string | null = null;
      if (targetPlayerId) {
        const { data: targetPlayer } = await supabase
          .from("room_players")
          .select("user_id")
          .eq("id", targetPlayerId)
          .maybeSingle();
        targetUserId = targetPlayer?.user_id ?? null;
      }

      const { data: lastQ } = await supabase
        .from("questions")
        .select("round")
        .eq("room_id", roomId)
        .order("round", { ascending: false })
        .limit(1)
        .maybeSingle();
      const round = lastQ ? lastQ.round + 1 : 1;

      const { data: question, error } = await supabase
        .from("questions")
        .insert({
          room_id: roomId,
          sender_id: user.id,
          target_id: targetUserId,
          question_text: questionText.trim(),
          mode: room.game_mode,
          round,
        })
        .select("id, question_text, round, mode, created_at, target_id, sender_id")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        question: {
          id: question.id,
          questionText: question.question_text,
          round: question.round,
          mode: question.mode,
          targetId: question.target_id,
          senderId: question.sender_id,
        },
      });
    }

    return NextResponse.json({ error: "وضع لعب غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("[questions/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Get questions for a room.
 *  - question_for_all mode:
 *    - During "questioning": show only your own pending question (round=0)
 *    - During "answering"+: show only the active question (round > 0)
 *  - question_for_random mode:
 *    - A question is visible only to sender + target
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

    const { data: room } = await supabase
      .from("rooms")
      .select("game_mode, status")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }

    // === GROUP MODE ===
    if (room.game_mode === "question_for_all") {
      // During "questioning": show only your own pending question
      if (room.status === "questioning") {
        const { data: myQuestion } = await supabase
          .from("questions")
          .select("id, question_text, round, mode, created_at, sender_id")
          .eq("room_id", roomId)
          .eq("sender_id", user.id)
          .eq("round", 0)
          .maybeSingle();

        // Count how many players have submitted
        const { count: playerCount } = await supabase
          .from("room_players")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId);

        const { count: submittedCount } = await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .eq("round", 0);

        return NextResponse.json({
          questions: myQuestion
            ? [{
                id: myQuestion.id,
                questionText: myQuestion.question_text,
                round: myQuestion.round,
                mode: myQuestion.mode,
                createdAt: myQuestion.created_at,
                isMyQuestion: true,
              }]
            : [],
          pendingCount: submittedCount ?? 0,
          playerCount: playerCount ?? 0,
          allSubmitted: (submittedCount ?? 0) >= (playerCount ?? 0),
        });
      }

      // During "answering"+ : show only the active question (round > 0)
      const { data: activeQuestions, error } = await supabase
        .from("questions")
        .select("id, question_text, round, mode, created_at, target_id, sender_id")
        .eq("room_id", roomId)
        .gt("round", 0)
        .order("round", { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        questions: (activeQuestions ?? []).map((q) => ({
          id: q.id,
          questionText: q.question_text,
          round: q.round,
          mode: q.mode,
          createdAt: q.created_at,
          targetUserId: q.target_id,
          senderId: q.sender_id,
          isMyQuestion: q.sender_id === user.id,
          isTargetedToMe: q.target_id === user.id,
        })),
      });
    }

    // === RANDOM MODE ===
    const { data: questions, error } = await supabase
      .from("questions")
      .select("id, question_text, round, mode, created_at, target_id, sender_id")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let visibleQuestions = questions ?? [];
    if (room.game_mode === "question_for_random") {
      visibleQuestions = (questions ?? []).filter((q) => {
        if (q.sender_id === user.id) return true;
        if (q.target_id === user.id) return true;
        return false;
      });
    }

    return NextResponse.json({
      questions: visibleQuestions.map((q) => ({
        id: q.id,
        questionText: q.question_text,
        round: q.round,
        mode: q.mode,
        createdAt: q.created_at,
        targetUserId: q.target_id,
        senderId: q.sender_id,
        isMyQuestion: q.sender_id === user.id,
        isTargetedToMe: q.target_id === user.id,
      })),
    });
  } catch (e) {
    console.error("[questions/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
