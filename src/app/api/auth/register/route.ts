import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
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

    const existing = await db.profile.findUnique({
      where: { username },
    });
    if (existing) {
      return NextResponse.json(
        { error: "اسم المستخدم محجوز بالفعل" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const profile = await db.profile.create({
      data: { username, avatar, passwordHash },
      select: { id: true, username: true, avatar: true },
    });

    await setSessionCookie({
      userId: profile.id,
      username: profile.username,
    });

    return NextResponse.json({ user: profile });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 },
    );
  }
}
