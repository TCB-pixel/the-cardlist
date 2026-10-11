import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

const PAGE_SIZE = 50;

// ---------- GET : ประวัติแชท ?q=คำค้น&by=ai|admin|pending&page=0 ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const params = req.nextUrl.searchParams;
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const by = params.get("by");
  // ตัดอักขระที่มีความหมายใน filter ของ PostgREST ออก กันคำค้นไปเปลี่ยนเงื่อนไข
  const q = (params.get("q") ?? "").replace(/[,()*%\\]/g, " ").trim();

  let query = adminDb
    .from("chat_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (by === "ai" || by === "admin" || by === "pending") query = query.eq("replied_by", by);
  if (q) query = query.or(`message.ilike.%${q}%,reply.ilike.%${q}%,display_name.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data, total: count ?? 0, pageSize: PAGE_SIZE });
}
