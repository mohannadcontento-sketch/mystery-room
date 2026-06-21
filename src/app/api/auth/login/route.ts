import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
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
      return NextResponse.json(
        { error: "بيانات غير صالحة" },
        { status: 400 },
      );
    }

    const { username, password } = parsed.data;
    const profile = await db.profile.findUnique({ where: { username } });
    if (!profile) {
      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة" },
        { status: 401 },
      );
    }

    const ok = await verifyPassword(password, profile.passwordHash);
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
      },
    });
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
