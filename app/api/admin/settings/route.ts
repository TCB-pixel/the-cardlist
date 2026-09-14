import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

const ALLOWED_KEYS = ["facebook_page_url"] as const;

// ---------- GET : ค่าตั้งค่า + สถิติการกดไปเพจ ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "news:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [{ data: settings }, { count: total }, { count: clicked }] = await Promise.all([
    adminDb.from("site_settings").select("key, value"),
    adminDb.from("profiles").select("id", { count: "exact", head: true }),
    adminDb.from("profiles").select("id", { count: "exact", head: true }).not("fb_clicked_at", "is", null),
  ]);

  const map: Record<string, string | null> = {};
  for (const s of settings ?? []) map[s.key] = s.value;

  return NextResponse.json({
    settings: map,
    stats: { totalMembers: total ?? 0, fbClicked: clicked ?? 0 },
  });
}

// ---------- PATCH : บันทึกค่าตั้งค่า ----------
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, "news:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { key, value } = await req.json();
    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: "ไม่รู้จักค่าตั้งค่านี้" }, { status: 400 });
    }

    const clean = typeof value === "string" ? value.trim() : "";
    // ปล่อยค่าว่างได้ = ปิดการแสดงการ์ดชวนไลค์
    if (clean && !/^https:\/\/(www\.)?(facebook|fb)\.com\/.+/i.test(clean)) {
      return NextResponse.json(
        { error: "ต้องเป็นลิงก์เพจ Facebook เต็มรูปแบบ เช่น https://www.facebook.com/yourpage" },
        { status: 400 }
      );
    }

    const { error } = await adminDb
      .from("site_settings")
      .upsert({ key, value: clean || null, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, key, value: clean || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
