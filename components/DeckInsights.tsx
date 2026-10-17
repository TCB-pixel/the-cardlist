"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import { checkDeck } from "@/lib/deck-rules";

export type DeckCard = { card_name: string; quantity: number; card_number?: string; card_id?: string };
export type CardDetail = {
  id: string; lang: string; rarity: string | null; card_type: string | null; color: string | null;
  image_url: string | null; attrs: { cost?: string | number | null } | null;
};

// ข้อมูลการ์ดจากฐานข้อมูล (รูป ประเภท สี ค่าใช้) ของการ์ดที่เลือกจากช่องค้นหา
export function useCardDetails(cards: DeckCard[]) {
  const ids = useMemo(() => [...new Set(cards.map((c) => c.card_id).filter(Boolean) as string[])].sort(), [cards]);
  const [details, setDetails] = useState<Record<string, CardDetail>>({});
  useEffect(() => {
    const need = ids.filter((id) => !details[id]);
    if (!need.length) return;
    createClient()
      .from("tcg_cards")
      .select("id, lang, rarity, card_type, color, image_url, attrs")
      .in("id", need)
      .then(({ data }) => {
        if (!data?.length) return;
        setDetails((d) => ({ ...d, ...Object.fromEntries((data as CardDetail[]).map((x) => [x.id, x])) }));
      });
  }, [ids.join(",")]);
  return details;
}

type Owned = { card_id: string | null; card_number: string; card_name: string; tcg: string; quantity: number; status: string };

const ownKey = (game: string, c: { card_id?: string | null; card_number?: string; card_name: string }) =>
  c.card_number?.trim() ? `${game}|#${c.card_number.trim().toUpperCase()}` : `${game}|@${c.card_name.trim().toLowerCase()}`;

// กติกา · สถิติ · มีแล้ว/ยังขาด เทียบกับ Collection
export default function DeckInsights({ game, format, cards, details, userId }: {
  game: string; format: string; cards: DeckCard[]; details: Record<string, CardDetail>; userId: string;
}) {
  const { L } = useLang();
  const [owned, setOwned] = useState<Owned[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadOwned() {
    const { data } = await createClient()
      .from("collection_cards")
      .select("card_id, card_number, card_name, tcg, quantity, status")
      .eq("user_id", userId);
    setOwned((data as Owned[]) ?? []);
  }
  useEffect(() => { if (userId) loadOwned(); }, [userId]);

  const rule = checkDeck(game, format, cards.map((c) => {
    const d = c.card_id ? details[c.card_id] : undefined;
    return { name: c.card_name, number: c.card_number, quantity: c.quantity, card_type: d?.card_type, color: d?.color };
  }));

  // เส้นค่าใช้ (cost curve) — เฉพาะการ์ดที่มีค่า cost ในฐานข้อมูล (ตอนนี้คือ One Piece)
  const curve = useMemo(() => {
    const bins = Array(11).fill(0) as number[];
    let any = false;
    for (const c of cards) {
      const d = c.card_id ? details[c.card_id] : undefined;
      if (!d || d.card_type === "Leader") continue;
      const cost = parseInt(String(d.attrs?.cost ?? ""), 10);
      if (!Number.isFinite(cost)) continue;
      bins[Math.min(cost, 10)] += c.quantity;
      any = true;
    }
    return any ? bins : null;
  }, [cards, details]);

  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) {
      const t = c.card_id ? details[c.card_id]?.card_type : null;
      if (t && t !== "Leader") m.set(t, (m.get(t) ?? 0) + c.quantity);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards, details]);

  // มีแล้ว / ยังขาด (นับ "ที่มี" + "พร้อมแลก")
  const missing = useMemo(() => {
    if (!owned) return null;
    const have = new Map<string, number>();
    const haveById = new Map<string, number>();
    for (const o of owned) {
      if (o.status === "want") continue;
      have.set(ownKey(o.tcg, o), (have.get(ownKey(o.tcg, o)) ?? 0) + o.quantity);
      if (o.card_id) haveById.set(o.card_id, (haveById.get(o.card_id) ?? 0) + o.quantity);
    }
    const need = new Map<string, { c: DeckCard; qty: number }>();
    for (const c of cards) {
      const k = ownKey(game, c);
      need.set(k, { c, qty: (need.get(k)?.qty ?? 0) + c.quantity });
    }
    return [...need.entries()]
      .map(([k, { c, qty }]) => {
        const got = Math.max(have.get(k) ?? 0, c.card_id ? haveById.get(c.card_id) ?? 0 : 0);
        return { c, short: Math.max(0, qty - got) };
      })
      .filter((x) => x.short > 0);
  }, [owned, cards, game]);

  async function addMissingToWishlist() {
    if (!missing?.length || !owned) return;
    setAdding(true);
    setMsg("");
    const wanted = new Set(owned.filter((o) => o.status === "want").map((o) => ownKey(o.tcg, o)));
    const rows = missing
      .filter(({ c }) => !wanted.has(ownKey(game, c)))
      .map(({ c, short }) => {
        const d = c.card_id ? details[c.card_id] : undefined;
        return {
          user_id: userId, status: "want", quantity: short, condition: "NM",
          card_id: c.card_id ?? null, card_name: c.card_name, card_number: c.card_number ?? "", set_name: "",
          tcg: game, rarity: d?.rarity ?? "Rare", language: d?.lang ?? "",
        };
      });
    if (!rows.length) { setMsg(L("การ์ดที่ขาดอยู่ในรายการอยากได้ครบแล้ว", "Missing cards are already on your wishlist")); setAdding(false); return; }
    const { error } = await createClient().from("collection_cards").insert(rows);
    setMsg(error ? L("เพิ่มไม่สำเร็จ กรุณาลองใหม่", "Couldn't add. Please try again.") : L(`เพิ่ม ${rows.length} รายการลงอยากได้แล้ว`, `Added ${rows.length} to your wishlist`));
    setAdding(false);
    if (!error) loadOwned();
  }

  if (!cards.length) return null;
  const errors = rule.issues.filter((i) => i.level === "error");
  const warns = rule.issues.filter((i) => i.level === "warn");
  const maxBin = curve ? Math.max(...curve, 1) : 1;
  const shortTotal = missing?.reduce((s, x) => s + x.short, 0) ?? 0;

  return (
    <div className="space-y-3">
      {/* กติกา */}
      <div className="card px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-zinc-900">{L("ตรวจกติกาเบื้องต้น", "Basic rules check")}</p>
          <p className="text-[11px] text-zinc-500">{rule.main}{rule.target ? ` / ${rule.target}` : ""} {L("ใบ", "cards")}</p>
        </div>
        {!rule.checked && <p className="text-[11px] text-zinc-500">{L("ยังไม่มีกติกาของเกมนี้ในระบบ — แสดงเฉพาะจำนวนใบ", "No rules for this game yet — showing card count only")}</p>}
        {rule.checked && errors.length === 0 && <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">{L("ผ่านกติกาเบื้องต้นแล้ว", "Passes the basic rules")}</p>}
        {errors.length > 0 && (
          <ul className="bg-red-50 rounded-xl px-3 py-2 space-y-1">
            {errors.map((i, n) => <li key={n} className="text-xs text-red-700">{L(i.th, i.en)}</li>)}
          </ul>
        )}
        {warns.length > 0 && (
          <ul className="bg-amber-50 rounded-xl px-3 py-2 space-y-1 mt-2">
            {warns.map((i, n) => <li key={n} className="text-xs text-amber-800">{L(i.th, i.en)}</li>)}
          </ul>
        )}
        <p className="text-[11px] text-zinc-500 mt-2">{L("ยังไม่ตรวจ ban list / กติกาเฉพาะทัวร์ — เช็กประกาศทางการก่อนแข่ง", "Ban lists and event-specific rules aren't checked — confirm with official announcements")}</p>
      </div>

      {/* สถิติ */}
      {(curve || types.length > 0) && (
        <div className="card px-4 py-4">
          <p className="text-xs font-semibold text-zinc-900 mb-3">{L("สถิติเด็ค", "Deck stats")}</p>
          {curve && (
            <>
              <p className="text-[11px] text-zinc-500 mb-1">{L("จำนวนใบตามค่าใช้ (cost)", "Cards by cost")}</p>
              <div className="flex items-end gap-1 h-20" role="img" aria-label={L("กราฟจำนวนใบตามค่าใช้", "Cost curve chart")}>
                {curve.map((n, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                    {n > 0 && <span className="text-[11px] text-zinc-600">{n}</span>}
                    <div className="w-full bg-zinc-900 rounded-t" style={{ height: `${(n / maxBin) * 70}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {curve.map((_, i) => <span key={i} className="flex-1 text-center text-[11px] text-zinc-500">{i === 10 ? "10+" : i}</span>)}
              </div>
            </>
          )}
          {types.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {types.map(([t, n]) => <span key={t} className="text-[11px] bg-zinc-100 text-zinc-600 rounded-full px-3 py-1">{t} {n}</span>)}
            </div>
          )}
        </div>
      )}

      {/* มีแล้ว / ยังขาด */}
      <div className="card px-4 py-4">
        <p className="text-xs font-semibold text-zinc-900 mb-2">{L("เทียบกับคอลเลกชันของคุณ", "Compared with your collection")}</p>
        {!missing && <p className="text-[11px] text-zinc-500" role="status">{L("กำลังโหลด...", "Loading...")}</p>}
        {missing && missing.length === 0 && <p className="text-xs text-green-700">{L("มีการ์ดครบทั้งเด็คแล้ว", "You own every card in this deck")}</p>}
        {missing && missing.length > 0 && (
          <>
            <p className="text-[11px] text-zinc-500 mb-2">{L(`ยังขาด ${shortTotal} ใบ`, `${shortTotal} cards missing`)}</p>
            <ul className="space-y-1 mb-3">
              {missing.map(({ c, short }, i) => (
                <li key={i} className="flex justify-between text-[11px]">
                  <span className="text-zinc-700 truncate max-w-[75%]">{c.card_name}{c.card_number ? ` · ${c.card_number}` : ""}</span>
                  <span className="text-zinc-500">×{short}</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={addMissingToWishlist} disabled={adding} className="btn-outline w-full disabled:opacity-40">
              {adding ? L("กำลังเพิ่ม...", "Adding...") : L("เพิ่มการ์ดที่ขาดลงรายการอยากได้", "Add missing cards to wishlist")}
            </button>
          </>
        )}
        {msg && <p className="text-[11px] text-zinc-600 mt-2" role="status">{msg}</p>}
      </div>
    </div>
  );
}
