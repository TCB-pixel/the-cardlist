import { NextResponse } from "next/server";
import { adminDb, requireAdmin, toSlug } from "@/lib/require-admin";

// หา slug ที่ยังไม่ถูกใช้ — ถ้าซ้ำจะต่อท้ายด้วย -2, -3, ...
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "category";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const { data } = await adminDb
      .from("artist_categories")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

// ---------- GET : รายการหมวดหมู่ทั้งหมด ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "artists:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await adminDb
    .from("artist_categories")
    .select("*")
    .order("order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ categories: data ?? [] });
}

// ---------- POST : เพิ่มหมวดหมู่ ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "artists:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { name, order, active } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "กรอกชื่อหมวดหมู่" }, { status: 400 });

    const { data, error } = await adminDb
      .from("artist_categories")
      .insert({
        name: name.trim(),
        slug: await uniqueSlug(toSlug(name)),
        order: order ?? 1,
        active: active ?? true,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ category: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : แก้ไขหมวดหมู่ ----------
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, "artists:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id, name, order, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: "กรอกชื่อหมวดหมู่" }, { status: 400 });
      update.name = name.trim();
      update.slug = await uniqueSlug(toSlug(name), id);
    }
    if (order !== undefined) update.order = order;
    if (active !== undefined) update.active = active;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });
    }

    const { data, error } = await adminDb
      .from("artist_categories")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ category: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ลบหมวดหมู่ (การ์ดที่ผูกอยู่จะกลายเป็น "ไม่มีหมวดหมู่") ----------
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req, "artists:delete");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

  const { error } = await adminDb.from("artist_categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
