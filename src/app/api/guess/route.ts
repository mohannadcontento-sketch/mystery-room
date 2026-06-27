import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const guessSchema = z.object({
  answerId: z.string(),
  roomId: z.string(),
  guessedUserId: z.string(), // the user we think wrote this answer
});

/**
 * Submit a guess: "whose answer is this?"
 * - Each user can guess once per answer
 * - Cannot guess on own answer (no point)
 * - After guessing, the system checks if the guess is correct
 * - Correct guesses add +1 to the user's total_score
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = guessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    const { answerId, roomId, guessedUserId } = parsed.data;
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

    // Get the answer and its actual author
    const { data: answer } = await supabase
      .from("answers")
      .select("id, user_id, question_id")
      .eq("id", answerId)
      .maybeSingle();
    if (!answer) {
      return NextResponse.json({ error: "الإجابة غير موجودة" }, { status: 404 });
    }

    // Can't guess on your own answer
    if (answer.user_id === user.id) {
      return NextResponse.json(
        { error: "لا يمكنك التوقع على إجابتك" },
        { status: 400 },
      );
    }

    // Check if already guessed (toggle behavior)
    const { data: existingGuess } = await supabase
      .from("answer_guesses")
      .select("id, is_correct")
      .eq("answer_id", answerId)
      .eq("guesser_id", user.id)
      .maybeSingle();

    if (existingGuess) {
      // Unguess (toggle off)
      await supabase
        .from("answer_guesses")
        .delete()
        .eq("answer_id", answerId)
        .eq("guesser_id", user.id);

      // If the previous guess was correct, decrement score
      if (existingGuess.is_correct) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("total_score")
          .eq("id", user.id)
          .maybeSingle();
        const newScore = Math.max(0, (profile?.total_score ?? 1) - 1);
        await supabase
          .from("profiles")
          .update({ total_score: newScore })
          .eq("id", user.id);
      }

      return NextResponse.json({
        ok: true,
        guessed: false,
        isCorrect: null,
      });
    }

    // Check correctness: did the guesser correctly identify the author?
    const isCorrect = answer.user_id === guessedUserId;

    // Insert the guess
    const { error: insertError } = await supabase
      .from("answer_guesses")
      .insert({
        answer_id: answerId,
        guesser_id: user.id,
        guessed_user_id: guessedUserId,
        room_id: roomId,
        is_correct: isCorrect,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, guessed: true, message: "already guessed" });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // If correct, increment the user's score
    if (isCorrect) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_score")
        .eq("id", user.id)
        .maybeSingle();
      const newScore = (profile?.total_score ?? 0) + 1;
      await supabase
        .from("profiles")
        .update({ total_score: newScore })
        .eq("id", user.id);
    }

    return NextResponse.json({
      ok: true,
      guessed: true,
      isCorrect,
      // Reveal the actual author only after guessing
      actualAuthorId: answer.user_id,
    });
  } catch (e) {
    console.error("[guess]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** Get all guesses for a room (during revealing/chatting/finished). */
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

    // Get all guesses by this user in this room
    const { data: myGuesses, error } = await supabase
      .from("answer_guesses")
      .select("answer_id, guessed_user_id, is_correct")
      .eq("room_id", roomId)
      .eq("guesser_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map: answerId -> { guessedUserId, isCorrect }
    const guessesMap: Record<string, { guessedUserId: string; isCorrect: boolean }> = {};
    for (const g of myGuesses ?? []) {
      guessesMap[g.answer_id] = {
        guessedUserId: g.guessed_user_id,
        isCorrect: g.is_correct,
      };
    }

    // Count correct guesses
    const correctCount = (myGuesses ?? []).filter((g) => g.is_correct).length;

    return NextResponse.json({
      guesses: guessesMap,
      correctCount,
      totalGuesses: (myGuesses ?? []).length,
    });
  } catch (e) {
    console.error("[guess/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
