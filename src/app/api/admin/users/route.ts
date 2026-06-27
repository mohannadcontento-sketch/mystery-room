import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "فقط الأدمن" }, { status: 403 });

    const supabase = getSupabase();
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, username, avatar, role, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ users: users ?? [], currentUserId: admin.id });
  } catch (e) {
    console.error("[admin/users]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
