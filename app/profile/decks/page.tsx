"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useLang } from "@/lib/i18n";
import { loginHref } from "@/lib/auth-next";
import { publicError } from "@/lib/api-error";
import { FORMAT_MAP, tcgLabel, tcgOptions, formatOptions } from "@/lib/tcg";

type DeckCard = { card_name: string; quantity: number; card_number?: string };
type Deck = {
  id: string;
  name: string;
  tcg: string;
  format: string;
  description: string;
  cards: DeckCard[];
  created_at: string;
  updated_at: string;
};

const EMPTY_DECK = { name: "", tcg: "One Piece", format: "Standard", description: "", cards: [] as DeckCard[] };
const EMPTY_CARD = { card_name: "", quantity: 1, card_number: "" };

const chip = (on: boolean) =>
  `text-xs px-3 py-1.5 rounded-full transition-colors ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`;

export default function DecksPage() {
  const router = useRouter();
  const { L } = useLang();
  const [userId, setUserId] = useState("");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<"list" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [deck, setDeck] = useState(EMPTY_DECK);
  const [newCard, setNewCard] = useState(EMPTY_CARD);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadDecks(uid: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });
    if (error) {
      setLoadError(publicError(error, L("โหลดเด็คไม่สำเร็จ กรุณาลองใหม่", "Couldn't load your decks. Please try again.")));
      return;
    }
    setLoadError("");
    setDecks((data as Deck[]) ?? []);
  }

  async function init() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace(loginHref("/profile/decks")); return; }
    setUserId(session.user.id);
    await loadDecks(session.user.id);
    setLoading(false);
  }

  useEffect(() => { init(); }, []);

  function openNew() {
    setDeck(EMPTY_DECK);
    setEditId(null);
    setNewCard(EMPTY_CARD);
    setError("");
    setView("edit");
  }

  function openEdit(d: Deck) {
    setDeck({ name: d.name, tcg: d.tcg, format: d.format, description: d.description, cards: (d.cards ?? []).map((c) => ({ ...c })) });
    setEditId(d.id);
    setNewCard(EMPTY_CARD);
    setError("");
    setView("edit");
  }

  function addCard() {
    const name = newCard.card_name.trim();
    if (!name) return;
    const exists = deck.cards.some((c) => c.card_name === name);
    const cards = exists
      ? deck.cards.map((c) => (c.card_name === name ? { ...c, quantity: c.quantity + newCard.quantity } : c))
      : [...deck.cards, { ...newCard, card_name: name }];
    setDeck({ ...deck, cards });
    setNewCard(EMPTY_CARD);
  }

  function removeCard(idx: number) {
    setDeck({ ...deck, cards: deck.cards.filter((_, i) => i !== idx) });
  }

  function updateQty(idx: number, qty: number) {
    if (qty < 1) { removeCard(idx); return; }
    setDeck({ ...deck, cards: deck.cards.map((c, i) => (i === idx ? { ...c, quantity: qty } : c)) });
  }

  async function handleSave() {
    if (!deck.name.trim()) { setError(L("กรุณากรอกชื่อเด็ค", "Please enter a deck name")); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const now = new Date().toISOString();
    const payload = { ...deck, name: deck.name.trim(), updated_at: now };
    const { error } = editId
      ? await supabase.from("decks").update(payload).eq("id", editId).eq("user_id", userId)
      : await supabase.from("decks").insert({ ...payload, user_id: userId });
    if (error) {
      setError(publicError(error, L("บันทึกไม่สำเร็จ กรุณาลองใหม่", "Couldn't save. Please try again.")));
      setSaving(false);
      return;
    }
    await loadDecks(userId);
    setView("list");
    setSaving(false);
  }

  async function handleDelete(d: Deck) {
    if (!window.confirm(L(`ลบเด็ค "${d.name}"?`, `Delete deck "${d.name}"?`))) return;
    setDeleting(d.id);
    const supabase = createClient();
    const { error } = await supabase.from("decks").delete().eq("id", d.id).eq("user_id", userId);
    if (error) window.alert(publicError(error, L("ลบไม่สำเร็จ กรุณาลองใหม่", "Couldn't delete. Please try again.")));
    else await loadDecks(userId);
    setDeleting(null);
  }

  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);
  const ready = !loading && !loadError;

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar
        title={view === "list" ? "Deck Builder" : editId ? L("แก้ไขเด็ค", "Edit deck") : L("สร้างเด็คใหม่", "New deck")}
        showBack
        onBack={view === "edit" ? () => setView("list") : undefined}
        rightSlot={ready && (view === "list" ? (
          <button type="button" onClick={openNew} className="text-xs font-semibold text-zinc-900 px-2 py-2">{L("+ สร้างเด็ค", "+ New deck")}</button>
        ) : (
          <button type="button" onClick={handleSave} disabled={saving} className="text-xs font-semibold text-zinc-900 px-2 py-2 disabled:opacity-40">
            {saving ? L("กำลังบันทึก...", "Saving...") : L("บันทึก", "Save")}
          </button>
        ))}
      />

      {/* กำลังโหลด */}
      {loading && (
        <div className="px-4 py-4 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 bg-zinc-100 animate-pulse rounded-2xl" />)}
        </div>
      )}

      {/* โหลดไม่สำเร็จ */}
      {!loading && loadError && (
        <div className="px-4 py-4">
          <div className="bg-red-50 rounded-2xl px-4 py-4">
            <p className="text-xs text-red-700 mb-3">{loadError}</p>
            <button type="button" onClick={init} className="btn-outline bg-white">{L("ลองใหม่", "Try again")}</button>
          </div>
        </div>
      )}

      {/* รายการเด็ค */}
      {ready && view === "list" && (
        <div className="px-4 py-4 space-y-3">
          {decks.length === 0 && (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm text-zinc-500 mb-1">{L("ยังไม่มีเด็ค", "No decks yet")}</p>
              <p className="text-[11px] text-zinc-500 mb-4">{L("สร้างเด็คแรกของคุณได้เลย", "Build your first deck now")}</p>
              <button type="button" onClick={openNew} className="btn-primary px-6 py-2.5">{L("สร้างเด็ค", "Create deck")}</button>
            </div>
          )}
          {decks.map((d) => {
            const total = d.cards?.reduce((s, c) => s + c.quantity, 0) ?? 0;
            return (
              <div key={d.id} className="card px-4 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{d.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{tcgLabel(d.tcg)} · {d.format} · {total} {L("ใบ", "cards")}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => openEdit(d)} className="text-[11px] text-zinc-600 underline px-2 py-2">{L("แก้ไข", "Edit")}</button>
                    <button type="button" onClick={() => handleDelete(d)} disabled={deleting === d.id}
                      className="text-[11px] text-red-600 underline px-2 py-2 disabled:opacity-40">
                      {deleting === d.id ? "..." : L("ลบ", "Delete")}
                    </button>
                  </div>
                </div>
                {d.description && <p className="text-[11px] text-zinc-500">{d.description}</p>}
                {d.cards?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1">
                    {d.cards.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-600 truncate max-w-[70%]">{c.card_name}</span>
                        <span className="text-[11px] text-zinc-500">×{c.quantity}</span>
                      </div>
                    ))}
                    {d.cards.length > 4 && (
                      <p className="text-[11px] text-zinc-500">+{d.cards.length - 4} {L("รายการอื่นๆ", "more")}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* สร้าง/แก้ไขเด็ค */}
      {ready && view === "edit" && (
        <div className="px-4 py-4 space-y-4">
          <div className="card px-4 py-4 space-y-3">
            <input className="input" placeholder={L("ชื่อเด็ค *", "Deck name *")} value={deck.name}
              onChange={(e) => setDeck({ ...deck, name: e.target.value })} />
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">{L("เกม", "Game")}</p>
              <div className="flex gap-2 flex-wrap">
                {tcgOptions(deck.tcg).map((t) => (
                  <button key={t} type="button" aria-pressed={deck.tcg === t} className={chip(deck.tcg === t)}
                    onClick={() => setDeck({ ...deck, tcg: t, format: deck.tcg === t ? deck.format : (FORMAT_MAP[t]?.[0] ?? "Standard") })}>
                    {tcgLabel(t)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">Format</p>
              <div className="flex gap-2 flex-wrap">
                {formatOptions(deck.tcg, deck.format).map((f) => (
                  <button key={f} type="button" aria-pressed={deck.format === f} className={chip(deck.format === f)}
                    onClick={() => setDeck({ ...deck, format: f })}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <input className="input" placeholder={L("คำอธิบายเด็ค (ไม่บังคับ)", "Deck description (optional)")} value={deck.description}
              onChange={(e) => setDeck({ ...deck, description: e.target.value })} />
          </div>

          {/* เพิ่มการ์ด */}
          <div className="card px-4 py-4">
            <p className="text-xs font-semibold text-zinc-900 mb-3">
              {L("เพิ่มการ์ด", "Add cards")} <span className="text-zinc-500 font-normal">({totalCards} {L("ใบ", "cards")})</span>
            </p>
            <div className="flex gap-2 mb-2">
              <input className="input flex-1 min-w-0" placeholder={L("ชื่อการ์ด", "Card name")} value={newCard.card_name}
                onChange={(e) => setNewCard({ ...newCard, card_name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addCard()} />
              <div className="flex items-center border border-zinc-200 bg-zinc-50 rounded-xl flex-shrink-0">
                <button type="button" aria-label={L("ลดจำนวน", "Decrease")} onClick={() => setNewCard({ ...newCard, quantity: Math.max(1, newCard.quantity - 1) })}
                  className="w-9 h-11 text-zinc-600">−</button>
                <span className="text-sm w-5 text-center font-medium">{newCard.quantity}</span>
                <button type="button" aria-label={L("เพิ่มจำนวน", "Increase")} onClick={() => setNewCard({ ...newCard, quantity: newCard.quantity + 1 })}
                  className="w-9 h-11 text-zinc-600">+</button>
              </div>
              <button type="button" aria-label={L("เพิ่มการ์ดลงเด็ค", "Add card to deck")} onClick={addCard} className="btn-primary px-4 flex-shrink-0">+</button>
            </div>
            <input className="input" placeholder={L("เลขการ์ด เช่น OP01-001 (ไม่บังคับ)", "Card number, e.g. OP01-001 (optional)")} value={newCard.card_number}
              onChange={(e) => setNewCard({ ...newCard, card_number: e.target.value })} />
          </div>

          {/* การ์ดในเด็ค */}
          {deck.cards.length > 0 && (
            <div className="card px-4 py-2">
              {deck.cards.map((c, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b border-zinc-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate">{c.card_name}</p>
                    {c.card_number && <p className="text-[11px] text-zinc-500">{c.card_number}</p>}
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <button type="button" aria-label={L(`ลด ${c.card_name}`, `Decrease ${c.card_name}`)} onClick={() => updateQty(i, c.quantity - 1)} className="w-10 h-10 text-zinc-600">−</button>
                    <span className="text-xs font-semibold w-5 text-center">{c.quantity}</span>
                    <button type="button" aria-label={L(`เพิ่ม ${c.card_name}`, `Increase ${c.card_name}`)} onClick={() => updateQty(i, c.quantity + 1)} className="w-10 h-10 text-zinc-600">+</button>
                    <button type="button" aria-label={L(`เอา ${c.card_name} ออก`, `Remove ${c.card_name}`)} onClick={() => removeCard(i)} className="w-10 h-10 flex items-center justify-center text-red-600">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full py-3.5 text-sm disabled:opacity-40">
            {saving ? L("กำลังบันทึก...", "Saving...") : editId ? L("บันทึกการแก้ไข", "Save changes") : L("สร้างเด็ค", "Create deck")}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
