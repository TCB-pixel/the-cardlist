import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminDb, requireAdmin } from "@/lib/require-admin";
import { TCG_LIST } from "@/lib/tcg";

// ฐานข้อมูลการ์ด (tcg_cards) — ทีมร้านค้นดู และเพิ่ม/ลบการ์ดที่แหล่งข้อมูลฟรียังไม่มี (source = 'manual')
// การ์ดจาก TCGdex / optcgapi มาจากสคริปต์ scripts/sync-tcg-cards.mjs เท่านั้น แก้ผ่านหน้านี้ไม่ได้

const LANGS = ["en", "th", "ja"];
const clean = (q: string) => q.replace(/[,()%*\\]/g, " ").trim();
const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---------- GET : ค้นการ์ด + จำนวนการ์ดแยกตามเกม/แหล่ง ----------
export async function GET(req: Request) {
  const auth = await requireAdmin(req, "products:view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const q = clean(url.searchParams.get("q") ?? "");
  const game = url.searchParams.get("game") ?? "";
  const source = url.searchParams.get("source") ?? "";

  let query = adminDb
    .from("tcg_cards")
    .select("id, game, lang, set_code, set_name, card_number, variant, name, rarity, card_type, image_url, source, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (game) query = query.eq("game", game);
  if (source) query = query.eq("source", source);
  if (q) query = query.or(`name.ilike.%${q}%,card_number.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "โหลดฐานข้อมูลการ์ดไม่สำเร็จ — ตาราง tcg_cards อาจยังไม่ถูกสร้าง" }, { status: 400 });

  const counts: Record<string, number> = {};
  for (const g of TCG_LIST) {
    const { count } = await adminDb.from("tcg_cards").select("id", { count: "exact", head: true }).eq("game", g);
    counts[g] = count ?? 0;
  }
  return NextResponse.json({ cards: data ?? [], counts });
}

// ข้อมูลเฉพาะเกมที่ตัวตรวจกติกาเด็คใช้ (lib/deck-rules.ts)
function gameAttrs(game: string, body: Record<string, unknown>): Record<string, unknown> {
  if (game === "Battle of Talingchan") {
    return { tags: [body.only1 === true && "only1", body.biased === true && "biased"].filter(Boolean) };
  }
  if (game === "Monsnatch") {
    const pts = parseInt(String(body.deck_points ?? ""), 10);
    return Number.isFinite(pts) && pts >= 0 && pts <= 25 ? { deck_points: pts } : {};
  }
  return {};
}

// ---------- POST : เพิ่มการ์ดเอง ----------
export async function POST(req: Request) {
  const auth = await requireAdmin(req, "products:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }

  const game = text(body.game);
  const lang = text(body.lang) || "en";
  const name = text(body.name);
  const card_number = text(body.card_number, 40);
  const set_code = text(body.set_code, 40);
  const image_url = text(body.image_url, 500);

  if (!TCG_LIST.includes(game)) return NextResponse.json({ error: "เลือกเกม" }, { status: 400 });
  if (!LANGS.includes(lang)) return NextResponse.json({ error: "ภาษาไม่ถูกต้อง" }, { status: 400 });
  if (!name || !card_number || !set_code) return NextResponse.json({ error: "กรอกชื่อการ์ด เลขการ์ด และรหัสเซต" }, { status: 400 });
  if (image_url && !/^https:\/\//i.test(image_url)) return NextResponse.json({ error: "ลิงก์รูปต้องขึ้นต้นด้วย https://" }, { status: 400 });

  const { data, error } = await adminDb.from("tcg_cards").insert({
    game, lang, name, card_number, set_code,
    set_name: text(body.set_name) || set_code,
    variant: text(body.variant, 40) || "normal",
    rarity: text(body.rarity, 40) || null,
    card_type: text(body.card_type, 40) || null,
    image_url: image_url || null,
    attrs: gameAttrs(game, body),
    source: "manual",
    source_id: randomUUID(),
  }).select("id").single();
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ id: data.id });
}

// ---------- DELETE : ลบการ์ดที่เพิ่มเอง (การ์ดจากแหล่งข้อมูลลบไม่ได้) ----------
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req, "products:delete");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "ไม่พบการ์ด" }, { status: 400 });
  const { error, count } = await adminDb.from("tcg_cards").delete({ count: "exact" }).eq("id", id).eq("source", "manual");
  if (error) return NextResponse.json({ error: "ลบไม่สำเร็จ" }, { status: 400 });
  if (!count) return NextResponse.json({ error: "ลบได้เฉพาะการ์ดที่ทีมร้านเพิ่มเอง" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
