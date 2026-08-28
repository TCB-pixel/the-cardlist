import { NextResponse } from "next/server";
import { adminDb, requireAdmin, toSlug } from "@/lib/require-admin";

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "artist";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const { data } = await adminDb
      .from("artists")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

const FIELDS = ["bio", "avatar_url", "instagram_url", "facebook_url", "x_url"] as const;

// ---------- GET : รายชื่อศิลปิน + จำนวนการ์ดของแต่ละคน ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "artists:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await adminDb
    .from("artists")
    .select("*, artist_cards(count)")
    .order("order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const artists = (data ?? []).map((a: any) => {
    const { artist_cards, ...rest } = a;
    return { ...rest, cardCount: artist_cards?.[0]?.count ?? 0 };
  });

  return NextResponse.json({ artists });
}

// ---------- POST : เพิ่มศิลปิน ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "artists:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "กรอกชื่อศิลปิน" }, { status: 400 });

    const row: Record<string, unknown> = {
      name: body.name.trim(),
      slug: await uniqueSlug(toSlug(body.name)),
      order: body.order ?? 1,
      active: body.active ?? true,
    };
    for (const f of FIELDS) row[f] = body[f]?.trim() || null;

    const { data, error } = await adminDb.from("artists").insert(row).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ artist: { ...data, cardCount: 0 } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- PATCH : แก้ไขศิลปิน ----------
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, "artists:edit");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: "กรอกชื่อศิลปิน" }, { status: 400 });
      update.name = body.name.trim();
      update.slug = await uniqueSlug(toSlug(body.name), body.id);
    }
    if (body.order !== undefined) update.order = body.order;
    if (body.active !== undefined) update.active = body.active;
    for (const f of FIELDS) {
      if (body[f] !== undefined) update[f] = body[f]?.trim() || null;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });
    }

    const { data, error } = await adminDb
      .from("artists")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ artist: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// ---------- DELETE : ลบศิลปิน (การ์ดของศิลปินคนนี้จะถูกลบตาม cascade) ----------
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req, "artists:delete");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

  const { error } = await adminDb.from("artists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
