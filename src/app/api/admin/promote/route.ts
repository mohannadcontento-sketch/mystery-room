import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(3).max(20),
  role: z.enum(["user", "admin"]),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "فقط الأدمن" }, { status: 403 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

    const { username, role } = parsed.data;
    if (username === admin.username && role === "user") {
      return NextResponse.json({ error: "لا يمكنك إزالة دورك كأدمن من نفسك" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: target } = await supabase
      .from("profiles")
      .select("id, username, avatar, role, created_at")
      .eq("username", username)
      .maybeSingle();

    if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

    const { data: updated, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", target.id)
      .select("id, username, avatar, role, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      user: updated,
      message: `تم تغيير دور ${username} إلى ${role === "admin" ? "أدمن" : "مستخدم عادي"}`,
    });
  } catch (e) {
    console.error("[admin/promote]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
