import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: รายชื่อผู้เข้างานทั้งหมด (General + Priority)
// ใช้ SERVICE ROLE เพื่อ bypass RLS — client-side query มองเห็นแค่ row ตัวเอง
// วางไฟล์: app/api/admin/tickets/route.ts
// ─────────────────────────────────────────────────────────────────────────────

// ตารางทีมงานที่เป็นไปได้ (เผื่อ schema ต่างเวอร์ชัน) — เป็นทีมงานก็เข้าได้หมด ทุก role
const ADMIN_TABLES = ["admin_staff", "admin_users"];

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type Svc = ReturnType<typeof svc>;

// เช็คว่าเป็นทีมงานไหม — match ด้วย id หรือ email, active ต้องไม่เป็น false
async function isTeamMember(supabase: Svc, userId: string, email?: string | null): Promise<boolean> {
  const filters = [`id.eq.${userId}`];
  if (email) filters.push(`email.eq.${email}`);
  const orFilter = filters.join(",");

  for (const table of ADMIN_TABLES) {
    const { data, error } = await supabase.from(table).select("*").or(orFilter).limit(1);
    if (error) continue;              // ตารางไม่มี/คอลัมน์ไม่ตรง → ลองตารางถัดไป
    const row: any = data?.[0];
    if (row && row.active !== false) return true;   // เจอ และไม่ได้ถูกปิดใช้งาน
  }
  return false;
}

// ตรวจสิทธิ์: รับ access_token จาก Authorization: Bearer แล้วเช็คว่าอยู่ในทีมงาน
async function getAdminUser(
  req: Request,
  supabase: Svc
): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const allowed = await isTeamMember(supabase, user.id, user.email);
  if (!allowed) return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };

  return { ok: true, userId: user.id };
}

export async function GET(req: Request) {
  const supabase = svc();
  const auth = await getAdminUser(req, supabase);
  if (!auth.ok) return auth.res;

  // 1) ดึงทั้งสองตาราง (select * เพื่อไม่ต้องเดาชื่อคอลัมน์)
  const [priRes, genRes] = await Promise.all([
    supabase.from("event_tickets").select("*").order("created_at", { ascending: false }),
    supabase.from("general_registrations").select("*").order("created_at", { ascending: false }),
  ]);

  const priRows: any[] = priRes.data ?? [];
  const genRows: any[] = genRes.data ?? [];

  // 2) เก็บ id ไป enrich แบบ query แยก (ไม่ join — กัน FK relationship พัง)
  const userIds = Array.from(new Set([...priRows, ...genRows].map((r) => r.user_id).filter(Boolean)));
  const eventIds = Array.from(new Set([...priRows, ...genRows].map((r) => r.event_id).filter(Boolean)));

  const [profilesRes, eventsRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, username, display_name, avatar_url, line_user_id, email").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    eventIds.length
      ? supabase.from("events").select("id, title, date").in("id", eventIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const pMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const eMap = new Map((eventsRes.data ?? []).map((e: any) => [e.id, e]));

  const norm = (r: any, source: "priority" | "general") => {
    const p: any = pMap.get(r.user_id) || {};
    const e: any = eMap.get(r.event_id) || {};
    return {
      id: r.id,
      source,
      ticket_type: source === "priority" ? "Priority Guest" : "General",
      // General ฟรี/auto → ถือว่า approved เสมอ; Priority ใช้ status จริง
      status: source === "priority" ? (r.status || "pending") : "approved",
      user_id: r.user_id,
      event_id: r.event_id,
      display_name: p.display_name || p.username || "—",
      username: p.username || "",
      email: p.email || "",
      avatar_url: p.avatar_url || "",
      line_user_id: p.line_user_id || "",
      line_linked: !!p.line_user_id,
      event_title: e.title || "—",
      event_date: e.date || null,
      qr_code: r.qr_code || "",
      pack_paid: source === "general" ? !!r.pack_paid : null,
      created_at: r.created_at || null,
    };
  };

  const tickets = [
    ...priRows.map((r) => norm(r, "priority")),
    ...genRows.map((r) => norm(r, "general")),
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return NextResponse.json({ tickets });
}

// อนุมัติ / ปฏิเสธ Priority ticket (client-side update ก็โดน RLS บล็อกเหมือนกัน)
export async function PATCH(req: Request) {
  const supabase = svc();
  const auth = await getAdminUser(req, supabase);
  if (!auth.ok) return auth.res;

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { error } = await supabase.from("event_tickets").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
