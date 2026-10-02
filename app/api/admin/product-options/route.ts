import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

// ตัวเลือก dropdown ของหน้าสินค้า (TCG / หมวดหมู่) — แอดมินเพิ่มเองได้โดยไม่ต้อง deploy
const KINDS = ["tcg", "category"] as const;
type Kind = (typeof KINDS)[number];

// ---------- GET : ตัวเลือกทั้งหมด แยกตามประเภท ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "products:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await adminDb
    .from("product_options")
    .select("id, kind, value, order, active")
    .eq("active", true)
    .order("order", { ascending: true })
    .order("value", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const out: Record<Kind, string[]> = { tcg: [], category: [] };
  for (const row of data ?? []) {
    if ((KINDS as readonly string[]).includes(row.kind)) out[row.kind as Kind].push(row.value);
  }
  return NextResponse.json(out);
}

// ---------- POST : เพิ่มตัวเลือกใหม่ ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "products:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { kind, value } = await req.json();
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: "ประเภทตัวเลือกไม่ถูกต้อง" }, { status: 400 });
    }
    const v = String(value ?? "").trim();
    if (!v) return NextResponse.json({ error: "กรอกชื่อตัวเลือก" }, { status: 400 });
    if (v.length > 40) return NextResponse.json({ error: "ชื่อยาวเกินไป (ไม่เกิน 40 ตัวอักษร)" }, { status: 400 });

    // มีอยู่แล้วก็ถือว่าสำเร็จ จะได้ไม่ต้องให้แอดมินมานั่งเดาว่าซ้ำไหม
    const { data: existing } = await adminDb
      .from("product_options")
      .select("id, active")
      .eq("kind", kind)
      .eq("value", v)
      .maybeSingle();

    if (existing) {
      if (!existing.active) {
        await adminDb.from("product_options").update({ active: true }).eq("id", existing.id);
      }
      return NextResponse.json({ value: v, existed: true });
    }

    const { error } = await adminDb
      .from("product_options")
      .insert({ kind, value: v, order: 99 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ value: v, existed: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
