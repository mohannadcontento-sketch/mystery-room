import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashPassword, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6).max(64),
  avatar: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { username, password, avatar } = parsed.data;
    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "اسم المستخدم محجوز بالفعل" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    // First registered user becomes admin (bootstrap)
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    const role = (count ?? 0) === 0 ? "admin" : "user";

    // Try with role first, fall back without (if column doesn't exist)
    let profile: any = null;
    let error: any = null;

    const res = await supabase
      .from("profiles")
      .insert({ username, avatar, password_hash: passwordHash, role })
      .select("id, username, avatar, role")
      .single();
    profile = res.data;
    error = res.error;

    if (error && error.message && error.message.includes("role")) {
      const res2 = await supabase
        .from("profiles")
        .insert({ username, avatar, password_hash: passwordHash })
        .select("id, username, avatar")
        .single();
      profile = res2.data;
      error = res2.error;
      if (profile) profile.role = role;
    }

    if (error || !profile) {
      return NextResponse.json(
        { error: "حدث خطأ أثناء إنشاء الحساب: " + (error?.message || "") },
        { status: 500 },
      );
    }

    await setSessionCookie({ userId: profile.id, username: profile.username });

    return NextResponse.json({ user: profile });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 },
    );
  }
}
