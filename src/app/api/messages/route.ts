import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  roomId: z.string(),
  message: z.string().min(1).max(500),
});

/** Persist a chat message. Uses real username now (not anonymous). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    const { roomId, message } = parsed.data;
    const supabase = getSupabase();

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

    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
    }
    if (room.status === "finished") {
      return NextResponse.json(
        { error: "الشات غير متاح في هذه المرحلة" },
        { status: 400 },
      );
    }

    // Store the REAL username (not anonymous) so everyone knows who's talking
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        room_id: roomId,
        anonymous_user: user.username, // Now using real username
        message: message.trim(),
      })
      .select("id, anonymous_user, message, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: {
        id: msg.id,
        anonymousUser: msg.anonymous_user, // Now contains real username
        message: msg.message,
        createdAt: msg.created_at,
        mine: true,
      },
    });
  } catch (e) {
    console.error("[messages/create]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/** List all chat messages for a room. */
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

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, anonymous_user, message, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Now anonymous_user contains the real username
    // We mark "mine" by comparing with the current user's username
    return NextResponse.json({
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        anonymousUser: m.anonymous_user, // Now real username
        message: m.message,
        createdAt: m.created_at,
        mine: m.anonymous_user === user.username,
      })),
    });
  } catch (e) {
    console.error("[messages/list]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
