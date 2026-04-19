"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

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

const TCG_LIST = ["One Piece", "Pokémon", "MTG", "Dragon Ball"];
const FORMAT_MAP: Record<string, string[]> = {
  "One Piece": ["Standard", "Pre-Release"],
  "Pokémon":   ["Standard", "Expanded", "Limited"],
  "MTG":       ["Standard", "Modern", "Commander", "Draft"],
  "Dragon Ball":["Standard"],
};

const EMPTY_DECK = { name: "", tcg: "One Piece", format: "Standard", description: "", cards: [] as DeckCard[] };

export default function DecksPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [deck, setDeck] = useState(EMPTY_DECK);
  const [newCard, setNewCard] = useState({ card_name: "", quantity: 1, card_number: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadDecks(uid: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });
    setDecks((data as Deck[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      await loadDecks(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  function openNew() {
    setDeck(EMPTY_DECK);
    setEditId(null);
    setNewCard({ card_name: "", quantity: 1, card_number: "" });
    setError("");
    setView("edit");
  }

  function openEdit(d: Deck) {
    setDeck({ name: d.name, tcg: d.tcg, format: d.format, description: d.description, cards: [...d.cards] });
    setEditId(d.id);
    setNewCard({ card_name: "", quantity: 1, card_number: "" });
    setError("");
    setView("edit");
  }

  function addCard() {
    if (!newCard.card_name.trim()) return;
    const existing = deck.cards.findIndex((c) => c.card_name === newCard.card_name.trim());
    if (existing >= 0) {
      const updated = [...deck.cards];
      updated[existing].quantity += newCard.quantity;
      setDeck({ ...deck, cards: updated });
    } else {
      setDeck({ ...deck, cards: [...deck.cards, { ...newCard, card_name: newCard.card_name.trim() }] });
    }
    setNewCard({ card_name: "", quantity: 1, card_number: "" });
  }

  function removeCard(idx: number) {
    const updated = deck.cards.filter((_, i) => i !== idx);
    setDeck({ ...deck, cards: updated });
  }

  function updateQty(idx: number, qty: number) {
    if (qty < 1) { removeCard(idx); return; }
    const updated = [...deck.cards];
    updated[idx].quantity = qty;
    setDeck({ ...deck, cards: updated });
  }

  async function handleSave() {
    if (!deck.name.trim()) { setError("กรุณากรอกชื่อเด็ค"); return; }
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      if (editId) {
        await supabase.from("decks").update({ ...deck, updated_at: now }).eq("id", editId);
      } else {
        await supabase.from("decks").insert({ ...deck, user_id: userId, updated_at: now });
      }
      await loadDecks(userId);
      setView("list");
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const supabase = createClient();
    await supabase.from("decks").delete().eq("id", id);
    await loadDecks(userId);
    setDeleting(null);
  }

  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3">
            {view === "list" ? (
              <Link href="/profile" className="text-zinc-400 active:text-zinc-700">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            ) : (
              <button onClick={() => setView("list")} className="text-zinc-400 active:text-zinc-700">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <span className="text-sm font-semibold text-zinc-900">
              {view === "list" ? "Deck Builder" : editId ? "แก้ไขเด็ค" : "สร้างเด็คใหม่"}
            </span>
          </div>
          {view === "list" ? (
            <button onClick={openNew} className="text-xs font-semibold text-zinc-900">+ สร้างเด็ค</button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="text-xs font-semibold text-zinc-900 disabled:opacity-40">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          )}
        </div>
      </header>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="px-4 py-4 space-y-3">
          {decks.length === 0 && (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm text-zinc-400 mb-1">ยังไม่มีเด็ค</p>
              <p className="text-[11px] text-zinc-400 mb-4">สร้างเด็คแรกของคุณได้เลย</p>
              <button onClick={openNew} className="btn-primary px-6 py-2.5">สร้างเด็ค</button>
            </div>
          )}
          {decks.map((d) => {
            const total = d.cards?.reduce((s, c) => s + c.quantity, 0) ?? 0;
            return (
              <div key={d.id} className="card px-4 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{d.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{d.tcg} · {d.format} · {total} ใบ</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEdit(d)} className="text-[11px] text-zinc-500 underline">แก้ไข</button>
                    <button onClick={() => handleDelete(d.id)} disabled={deleting === d.id}
                      className="text-[11px] text-red-400 underline disabled:opacity-40">
                      {deleting === d.id ? "..." : "ลบ"}
                    </button>
                  </div>
                </div>
                {d.description && <p className="text-[11px] text-zinc-400">{d.description}</p>}
                {d.cards?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-50 space-y-1">
                    {d.cards.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-600 truncate max-w-[70%]">{c.card_name}</span>
                        <span className="text-[11px] text-zinc-400">×{c.quantity}</span>
                      </div>
                    ))}
                    {d.cards.length > 4 && (
                      <p className="text-[10px] text-zinc-400">+{d.cards.length - 4} รายการอื่นๆ</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT VIEW */}
      {view === "edit" && (
        <div className="px-4 py-4 space-y-4">
          {/* Deck Info */}
          <div className="card px-4 py-4 space-y-3">
            <input className="input" placeholder="ชื่อเด็ค *" value={deck.name}
              onChange={(e) => setDeck({ ...deck, name: e.target.value })} />
            {/* TCG */}
            <div>
              <p className="text-[10px] text-zinc-400 mb-1.5">TCG</p>
              <div className="flex gap-2 flex-wrap">
                {TCG_LIST.map((t) => (
                  <button key={t} onClick={() => setDeck({ ...deck, tcg: t, format: FORMAT_MAP[t][0] })}
                    className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${deck.tcg === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* Format */}
            <div>
              <p className="text-[10px] text-zinc-400 mb-1.5">Format</p>
              <div className="flex gap-2 flex-wrap">
                {FORMAT_MAP[deck.tcg]?.map((f) => (
                  <button key={f} onClick={() => setDeck({ ...deck, format: f })}
                    className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${deck.format === f ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <input className="input" placeholder="คำอธิบายเด็ค (ไม่บังคับ)" value={deck.description}
              onChange={(e) => setDeck({ ...deck, description: e.target.value })} />
          </div>

          {/* Add Card */}
          <div className="card px-4 py-4">
            <p className="text-xs font-semibold text-zinc-900 mb-3">
              เพิ่มการ์ด <span className="text-zinc-400 font-normal">({totalCards} ใบ)</span>
            </p>
            <div className="flex gap-2 mb-2">
              <input className="input flex-1" placeholder="ชื่อการ์ด" value={newCard.card_name}
                onChange={(e) => setNewCard({ ...newCard, card_name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addCard()} />
              <div className="flex items-center border border-zinc-100 bg-zinc-50 rounded-xl px-2 gap-1">
                <button onClick={() => setNewCard({ ...newCard, quantity: Math.max(1, newCard.quantity - 1) })}
                  className="text-zinc-500 w-6 text-center">−</button>
                <span className="text-sm w-5 text-center font-medium">{newCard.quantity}</span>
                <button onClick={() => setNewCard({ ...newCard, quantity: newCard.quantity + 1 })}
                  className="text-zinc-500 w-6 text-center">+</button>
              </div>
              <button onClick={addCard} className="btn-primary px-3 py-2">+</button>
            </div>
            <input className="input text-xs" placeholder="เลขการ์ด เช่น OP01-001 (ไม่บังคับ)" value={newCard.card_number}
              onChange={(e) => setNewCard({ ...newCard, card_number: e.target.value })} />
          </div>

          {/* Card List */}
          {deck.cards.length > 0 && (
            <div className="card px-4 py-3 space-y-2">
              {deck.cards.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-zinc-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate">{c.card_name}</p>
                    {c.card_number && <p className="text-[10px] text-zinc-400">{c.card_number}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => updateQty(i, c.quantity - 1)} className="text-zinc-400 w-6 text-center">−</button>
                    <span className="text-xs font-semibold w-5 text-center">{c.quantity}</span>
                    <button onClick={() => updateQty(i, c.quantity + 1)} className="text-zinc-400 w-6 text-center">+</button>
                    <button onClick={() => removeCard(i)} className="text-red-400 ml-1">
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
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3.5 text-sm disabled:opacity-40">
            {saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "สร้างเด็ค"}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
