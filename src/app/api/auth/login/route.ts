import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const { username, password } = parsed.data;
    const supabase = getSupabase();

    // Try with role column first; fall back without
    let { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, avatar, role, password_hash")
      .eq("username", username)
      .maybeSingle();

    if (error && error.message && error.message.includes("role")) {
      const res2 = await supabase
        .from("profiles")
        .select("id, username, avatar, password_hash")
        .eq("username", username)
        .maybeSingle();
      profile = res2.data;
      error = res2.error;
      if (profile) (profile as any).role = "user";
    }

    if (error || !profile) {
      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة" },
        { status: 401 },
      );
    }

    const ok = await verifyPassword(password, profile.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة" },
        { status: 401 },
      );
    }

    await setSessionCookie({ userId: profile.id, username: profile.username });

    return NextResponse.json({
      user: {
        id: profile.id,
        username: profile.username,
        avatar: profile.avatar,
        role: profile.role ?? "user",
      },
    });
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
