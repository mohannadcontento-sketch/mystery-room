import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "فقط الأدمن" }, { status: 403 });

    const supabase = getSupabase();
    const [usersRes, adminsRes, roomsRes, activeRoomsRes, questionsRes, answersRes, messagesRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
      supabase.from("rooms").select("id", { count: "exact", head: true }),
      supabase.from("rooms").select("id", { count: "exact", head: true }).in("status", ["waiting", "questioning", "answering", "thinking", "revealing", "chatting"]),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("answers").select("id", { count: "exact", head: true }),
      supabase.from("messages").select("id", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      users: usersRes.count ?? 0,
      admins: adminsRes.count ?? 0,
      rooms: roomsRes.count ?? 0,
      activeRooms: activeRoomsRes.count ?? 0,
      questions: questionsRes.count ?? 0,
      answers: answersRes.count ?? 0,
      messages: messagesRes.count ?? 0,
    });
  } catch (e) {
    console.error("[admin/stats]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
