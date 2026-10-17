import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/require-admin";
import { checkDeck, toRuleCard } from "@/lib/deck-rules";
import { checkRegulation, DECKLIST_CONSENT_VERSION, STRICT_GAMES } from "@/lib/decklist";

// ผู้เล่นส่ง decklist ลงทัวร์ — ตรวจทุกอย่างฝั่ง server แล้วเก็บสำเนาถาวรใน event_decklists
// (ตารางนี้ไม่มี policy ให้ผู้เล่นเขียนเอง จึงเขียนผ่าน service role หลังตรวจแล้วเท่านั้น)

type DeckCard = { card_name: string; quantity: number; card_number?: string; card_id?: string };

async function sessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req: NextRequest) {
  const user = await sessionUser();
  if (!user) return bad("กรุณาเข้าสู่ระบบก่อนส่ง decklist", 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad("ข้อมูลไม่ถูกต้อง"); }
  const eventId = String(body.eventId ?? "");
  const deckId = String(body.deckId ?? "");
  const playerName = String(body.playerName ?? "").trim().slice(0, 60);
  const deckCode = String(body.deckCode ?? "").trim().slice(0, 120);
  if (body.consent !== true) return bad("กรุณาติ๊กยอมรับการเก็บข้อมูลการแข่งก่อนส่ง");
  if (!playerName) return bad("กรอกชื่อเล่นที่ใช้แข่ง");

  const { data: event } = await adminDb
    .from("events")
    .select("id, title, date, tcg, decklist_enabled, decklist_deadline, decklist_game, decklist_regulation")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || !event.decklist_enabled) return bad("ทัวร์นี้ไม่ได้เปิดรับ decklist", 404);
  if (event.decklist_deadline && Date.parse(event.decklist_deadline) <= Date.now()) return bad("ปิดรับ decklist ของทัวร์นี้แล้ว");

  const { data: deck } = await adminDb
    .from("decks")
    .select("id, name, tcg, format, cards")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deck) return bad("ไม่พบเด็คนี้", 404);

  // เกมของทัวร์: ตั้งไว้เฉพาะ → ใช้ค่านั้น · ไม่ได้ตั้ง/เป็นงานรวมหลายเกม → ใช้เกมของเด็ค
  const eventGame = event.decklist_game || (event.tcg && event.tcg !== "Mixed" ? event.tcg : "");
  if (eventGame && eventGame !== deck.tcg) return bad(`เด็คนี้เป็นเกม ${deck.tcg} แต่ทัวร์นี้แข่ง ${eventGame}`);
  const game = eventGame || deck.tcg;

  const cards = (deck.cards ?? []) as DeckCard[];
  if (!cards.length) return bad("เด็คนี้ยังไม่มีการ์ด");
  const ids = [...new Set(cards.map((c) => c.card_id).filter(Boolean) as string[])];
  const details = new Map<string, { card_type: string | null; color: string | null; image_url: string | null; attrs: { regulation?: string; tags?: string[]; deck_points?: number } | null }>();
  if (ids.length) {
    const { data } = await adminDb.from("tcg_cards").select("id, card_type, color, image_url, attrs").in("id", ids);
    for (const d of data ?? []) details.set(d.id, d);
  }
  const snapshot = cards.map((c) => {
    const d = c.card_id ? details.get(c.card_id) : undefined;
    return {
      card_name: c.card_name, card_number: c.card_number ?? "", quantity: c.quantity, card_id: c.card_id ?? null,
      card_type: d?.card_type ?? null, color: d?.color ?? null, image_url: d?.image_url ?? null,
      regulation: d?.attrs?.regulation ?? null,
      tags: d?.attrs?.tags ?? null, deck_points: d?.attrs?.deck_points ?? null,
    };
  });

  // ข้อที่ "ตรวจไม่ได้" (การ์ดยังไม่มีข้อมูล) ไม่บล็อกการส่ง — staff ตรวจต่อ
  const rule = checkDeck(game, deck.format, cards.map((c) => toRuleCard(c, c.card_id ? details.get(c.card_id) : null)));
  const issues = [...rule.issues, ...(game === "Pokémon" ? checkRegulation(event.decklist_regulation, snapshot) : [])];
  const errors = issues.filter((i) => i.level === "error");
  if (STRICT_GAMES.includes(game) && errors.length) {
    return bad("เด็คยังไม่ผ่านกติกา — แก้ตามรายการแล้วส่งใหม่", 422, { issues });
  }

  const { data: booking } = await adminDb
    .from("bookings")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const row = {
    event_id: event.id, user_id: user.id, booking_id: booking?.id ?? null,
    event_title: event.title, event_date: event.date ?? null,
    player_name: playerName, game, format: deck.format ?? "", deck_name: deck.name ?? "",
    cards: snapshot, card_count: rule.total, deck_code: deckCode, rule_issues: issues,
    status: "submitted", checked_by: null, checked_at: null, staff_note: "",
    consent_version: DECKLIST_CONSENT_VERSION, consent_at: now, updated_at: now,
  };

  // ส่งซ้ำก่อนปิดรับ = แทนที่ของเดิม (กลับไปสถานะ "ส่งแล้ว" ให้ staff ตรวจใหม่)
  const { data: existing } = await adminDb
    .from("event_decklists")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: saved, error } = existing
    ? await adminDb.from("event_decklists").update(row).eq("id", existing.id).select("id").single()
    : await adminDb.from("event_decklists").insert({ ...row, submitted_at: now }).select("id").single();
  if (error) {
    console.error("decklist save failed", error);
    return bad("ส่ง decklist ไม่สำเร็จ กรุณาลองใหม่", 500);
  }
  return NextResponse.json({ id: saved.id, updated: !!existing, warnings: issues.filter((i) => i.level !== "error") });
}
