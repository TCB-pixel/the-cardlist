import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/require-admin";

const TEXT_FIELDS = [
  "description", "image_url", "rarity", "collection",
  "story", "significance", "how_to_get",
] as const;

// แปลงค่าตัวเลขที่ส่งมาจากฟอร์ม ("" -> null, "100" -> 100)
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------- GET : การ์ดทั้งหมด (กรองด้วย ?artistId= ได้) ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "artists:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const artistId = new URL(req.url).searchParams.get("artistId");

  let q = adminDb
    .from("artist_cards")
    .select("*")
    .order("order", { ascending: true })
    .order("created_at", { ascending: true });
  if (artistId) q = q.eq("artist_id", artistId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ cards: data ?? [] });
}

// ---------- POST : เพิ่มการ์ด ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "artists:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    if (!body.artist_id) return NextResponse.json({ error: "เลือกศิลปินก่อน" }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: "กรอกชื่อการ์ด" }, { status: 400 });

    const row: Record<string, unknown> = {
      artist_id: body.artist_id,
      category_id: body.category_id || null,
      name: body.name.trim(),
      limited_count: num(body.limited_count),
      release_year: num(body.release_year),
      order: body.order ?? 1,
      active: body.active ?? true,
    };
    for (const f of TEXT_FIELDS) row[f] = body[f]?.trim() || null;

    const { data, error } = await adminDb.from("artist_cards").insert(row).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ card: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : แก้ไขการ์ด ----------
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, "artists:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: "กรอกชื่อการ์ด" }, { status: 400 });
      update.name = body.name.trim();
    }
    if (body.artist_id !== undefined) update.artist_id = body.artist_id;
    if (body.category_id !== undefined) update.category_id = body.category_id || null;
    if (body.limited_count !== undefined) update.limited_count = num(body.limited_count);
    if (body.release_year !== undefined) update.release_year = num(body.release_year);
    if (body.order !== undefined) update.order = body.order;
    if (body.active !== undefined) update.active = body.active;
    for (const f of TEXT_FIELDS) {
      if (body[f] !== undefined) update[f] = body[f]?.trim() || null;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });
    }

    const { data, error } = await adminDb
      .from("artist_cards")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ card: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ลบการ์ด ----------
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req, "artists:delete");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

  const { error } = await adminDb.from("artist_cards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
