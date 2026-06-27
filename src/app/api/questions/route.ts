import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  roomId: z.string(),
  questionText: z.string().min(3).max(280),
  targetPlayerId: z.string().optional(),
});

/** Create a question (sender is hidden from other players). */
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
        { error: "بيانات غير صالحة", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { roomId, questionText, targetPlayerId } = parsed.data;
    const supabase = getSupabase();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status, game_mode")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError || !room) {
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
    if (room.status !== "answering") {
      return NextResponse.json(
        { error: "غير مسموح بإنشاء سؤال في هذه المرحلة" },
        { status: 400 },
      );
    }

    // Determine round number
    const { data: lastQ } = await supabase
      .from("questions")
      .select("round")
      .eq("room_id", roomId)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();

    const round = lastQ ? lastQ.round + 1 : 1;

    // For question_for_random mode, target_id is the USER_ID of the target
    // (the API receives targetPlayerId which is room_player.id, we need to convert)
    let targetUserId: string | null = null;
    if (targetPlayerId && room.game_mode === "question_for_random") {
      const { data: targetPlayer } = await supabase
        .from("room_players")
        .select("user_id")
        .eq("id", targetPlayerId)
        .maybeSingle();
      targetUserId = targetPlayer?.user_id ?? null;
    }

    const { data: question, error: qError } = await supabase
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

    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    return NextResponse.json({
      question: {
        id: question.id,
        questionText: question.question_text,
        round: question.round,
        mode: question.mode,
        createdAt: question.created_at,
        targetId: question.target_id,
        senderId: question.sender_id,
      },
    });
  } catch (e) {
    console.error("[questions/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Get all questions for a room.
 *  - In question_for_all mode: all questions visible to everyone
 *  - In question_for_random mode: a question is visible ONLY to its target
 *    (and to the sender who wrote it) */
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

    // Get room to know the game mode
    const { data: room } = await supabase
      .from("rooms")
      .select("game_mode")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }

    const { data: questions, error } = await supabase
      .from("questions")
      .select("id, question_text, round, mode, created_at, target_id, sender_id")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter questions based on game mode:
    // - question_for_all: everyone sees all questions
    // - question_for_random: a question is visible only to:
    //   1. The sender (who wrote it)
    //   2. The target (who it was sent to)
    let visibleQuestions = questions ?? [];
    if (room.game_mode === "question_for_random") {
      visibleQuestions = (questions ?? []).filter((q) => {
        // Sender can see their own question
        if (q.sender_id === user.id) return true;
        // Target can see questions sent to them
        if (q.target_id === user.id) return true;
        // Otherwise hide
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
