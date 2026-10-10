import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

const ALLOWED_KEYS = ["facebook_page_url", "order_notify_line_ids", "order_notify_emails"] as const;

// LINE user id = U + hex 32 ตัว, group = C..., room = R...
const LINE_ID_RE = /^[UCR][0-9a-f]{32}$/;

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

  // รายชื่อทีมงานที่ผูก LINE ไว้แล้ว — ใช้เลือกผู้รับแจ้งเตือนคำสั่งซื้อโดยไม่ต้องหา id เอง
  const [{ data: adminRows }, { data: staffRows }] = await Promise.all([
    adminDb.from("admin_users").select("email"),
    adminDb.from("admin_staff").select("email"),
  ]);
  const emails = Array.from(
    new Set([...(adminRows ?? []), ...(staffRows ?? [])].map((r: any) => r.email).filter(Boolean))
  );

  let lineStaff: { name: string; email: string; line_user_id: string }[] = [];
  if (emails.length) {
    const { data: rows } = await adminDb
      .from("profiles")
      .select("display_name, username, email, line_user_id")
      .in("email", emails)
      .not("line_user_id", "is", null);
    lineStaff = (rows ?? []).map((r: any) => ({
      name: r.display_name || r.username || r.email,
      email: r.email,
      line_user_id: r.line_user_id,
    }));
  }

  return NextResponse.json({
    settings: map,
    stats: { totalMembers: total ?? 0, fbClicked: clicked ?? 0 },
    lineStaff,
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

    let clean = typeof value === "string" ? value.trim() : "";

    if (key === "facebook_page_url") {
      // ปล่อยค่าว่างได้ = ปิดการแสดงการ์ดชวนไลค์
      if (clean && !/^https:\/\/(www\.)?(facebook|fb)\.com\/.+/i.test(clean)) {
        return NextResponse.json(
          { error: "ต้องเป็นลิงก์เพจ Facebook เต็มรูปแบบ เช่น https://www.facebook.com/yourpage" },
          { status: 400 }
        );
      }
    }

    if (key === "order_notify_line_ids") {
      // ปล่อยค่าว่างได้ = ไม่แจ้งเตือนใครเลย
      const ids = clean.split(",").map((v) => v.trim()).filter(Boolean);
      const bad = ids.filter((id) => !LINE_ID_RE.test(id));
      if (bad.length) {
        return NextResponse.json(
          { error: `LINE ID ไม่ถูกต้อง: ${bad.join(", ")} — ต้องขึ้นต้นด้วย U แล้วตามด้วยตัวอักษร/ตัวเลข 32 ตัว` },
          { status: 400 }
        );
      }
      clean = Array.from(new Set(ids)).join(",");
    }

    if (key === "order_notify_emails") {
      // ปล่อยค่าว่างได้ = ไม่แจ้งเตือนทางอีเมล
      const emails = clean.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
      const bad = emails.filter((e) => !/^[^s@]+@[^s@]+.[^s@]+$/.test(e));
      if (bad.length) {
        return NextResponse.json({ error: `อีเมลไม่ถูกต้อง: ${bad.join(", ")}` }, { status: 400 });
      }
      clean = Array.from(new Set(emails)).join(",");
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
