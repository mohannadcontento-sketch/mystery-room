import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  questionId: z.string(),
  answerText: z.string().min(1).max(500),
});

/** Submit an answer for a question (userId is hidden from other players). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات غير صالحة" },
        { status: 400 },
      );
    }
    const { questionId, answerText } = parsed.data;
    const supabase = getSupabase();

    const { data: question } = await supabase
      .from("questions")
      .select("id, room_id")
      .eq("id", questionId)
      .maybeSingle();

    if (!question) {
      return NextResponse.json({ error: "السؤال غير موجود" }, { status: 404 });
    }

    // Check room status
    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", question.room_id)
      .maybeSingle();

    if (!room || room.status !== "answering") {
      return NextResponse.json(
        { error: "غير مسموح بالإجابة في هذه المرحلة" },
        { status: 400 },
      );
    }

    // Check for duplicate answer
    const { data: existing } = await supabase
      .from("answers")
      .select("id")
      .eq("question_id", questionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "لقد أجبت على هذا السؤال بالفعل" },
        { status: 400 },
      );
    }

    const { data: answer, error } = await supabase
      .from("answers")
      .insert({
        question_id: questionId,
        user_id: user.id,
        answer_text: answerText.trim(),
      })
      .select("id, answer_text, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ answer });
  } catch (e) {
    console.error("[answers/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Get all answers for a question. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get("questionId");
    if (!questionId) {
      return NextResponse.json(
        { error: "questionId مطلوب" },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    // Verify membership
    const { data: question } = await supabase
      .from("questions")
      .select("id, room_id, mode, target_id")
      .eq("id", questionId)
      .maybeSingle();

    if (!question) {
      return NextResponse.json({ error: "السؤال غير موجود" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("room_players")
      .select("id")
      .eq("room_id", question.room_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "أنت لست عضواً في هذه الغرفة" },
        { status: 403 },
      );
    }

    // Check room status — only reveal during revealing/chatting/finished
    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", question.room_id)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }

    // While answering or thinking, return just the count (no text)
    if (!["revealing", "chatting", "finished"].includes(room.status)) {
      const { count } = await supabase
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", questionId);
      return NextResponse.json({
        answers: [],
        count: count ?? 0,
        revealed: false,
      });
    }

    // Get all answers WITH author info (we'll reveal author only after guessing in the frontend)
    const { data: answers, error } = await supabase
      .from("answers")
      .select(
        "id, answer_text, created_at, votes_count, user_id, profiles!answers_user_id_fkey(username, avatar)",
      )
      .eq("question_id", questionId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get this user's guesses for these answers
    const answerIds = (answers ?? []).map((a) => a.id);
    const { data: myGuesses } = await supabase
      .from("answer_guesses")
      .select("answer_id, guessed_user_id, is_correct")
      .in("answer_id", answerIds)
      .eq("guesser_id", user.id);

    const guessesMap: Record<string, { guessedUserId: string; isCorrect: boolean }> = {};
    for (const g of myGuesses ?? []) {
      guessesMap[g.answer_id] = {
        guessedUserId: g.guessed_user_id,
        isCorrect: g.is_correct,
      };
    }

    // Build response — for each answer, include:
    // - the answer text
    // - the author's REAL username + avatar (since we're using real names now)
    // - whether the current user has guessed, and if so, whether they were correct
    const formattedAnswers = (answers ?? []).map((a) => {
      const profile = a.profiles as any;
      const myGuess = guessesMap[a.id];
      const isMyAnswer = a.user_id === user.id;
      return {
        id: a.id,
        answerText: a.answer_text,
        createdAt: a.created_at,
        votesCount: a.votes_count ?? 0,
        // Author info: for your own answer, you know it. For others, reveal only after guessing.
        authorId: isMyAnswer || myGuess ? a.user_id : null,
        authorUsername: isMyAnswer || myGuess ? profile?.username : null,
        authorAvatar: isMyAnswer || myGuess ? profile?.avatar : null,
        isMyAnswer,
        myGuess: myGuess
          ? {
              guessedUserId: myGuess.guessedUserId,
              isCorrect: myGuess.isCorrect,
            }
          : null,
      };
    });

    return NextResponse.json({
      answers: formattedAnswers,
      count: formattedAnswers.length,
      revealed: true,
    });
  } catch (e) {
    console.error("[answers/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
