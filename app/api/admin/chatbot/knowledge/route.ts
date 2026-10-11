import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

const CATEGORIES = ["งานแข่ง", "สินค้า", "ร้าน", "กติกา"];

function validate(body: any): string | null {
  if (!body.title?.trim()) return "กรอกหัวข้อ";
  if (!body.content?.trim()) return "กรอกเนื้อหา";
  if (!CATEGORIES.includes(body.category)) return "เลือกหมวดให้ถูกต้อง";
  return null;
}

// ---------- GET : ข้อมูลร้านทั้งหมด ----------
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await adminDb
    .from("knowledge")
    .select("*")
    .order("category")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ knowledge: data });
}

// ---------- POST : เพิ่มหัวข้อ ----------
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const invalid = validate(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { data, error } = await adminDb
    .from("knowledge")
    .insert({ title: body.title.trim(), category: body.category, content: body.content.trim(), active: body.active ?? true })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// ---------- PATCH : แก้ไขหัวข้อ / เปิด-ปิด ----------
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.title !== undefined || body.content !== undefined || body.category !== undefined) {
    const invalid = validate(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    update.title = body.title.trim();
    update.category = body.category;
    update.content = body.content.trim();
  }
  if (typeof body.active === "boolean") update.active = body.active;

  const { data, error } = await adminDb.from("knowledge").update(update).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// ---------- DELETE : ลบหัวข้อ ----------
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req, "chatbot:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  const { error } = await adminDb.from("knowledge").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
