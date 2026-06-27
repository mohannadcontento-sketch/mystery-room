import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const schema = z.object({ roomId: z.string() });

/** Delete a room (admin only). Cascades to all related data. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "فقط الأدمن يمكنه حذف الغرف" },
        { status: 403 },
      );
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    const { roomId } = parsed.data;
    const supabase = getSupabase();

    const { error } = await supabase.from("rooms").delete().eq("id", roomId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "تم حذف الغرفة" });
  } catch (e) {
    console.error("[admin/delete-room]", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
