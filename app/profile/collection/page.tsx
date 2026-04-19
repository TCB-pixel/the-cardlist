"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

type CollectionCard = {
  id: string;
  card_name: string;
  set_name: string;
  card_number: string;
  tcg: string;
  rarity: string;
  condition: string;
  quantity: number;
  note: string;
  created_at: string;
};

const TCG_LIST = ["One Piece", "Pokémon", "MTG", "Dragon Ball"];
const RARITY_LIST = ["Common", "Uncommon", "Rare", "Super Rare", "Secret Rare", "Special"];
const CONDITION_LIST = ["NM", "LP", "MP", "HP", "D"];
const CONDITION_LABEL: Record<string, string> = {
  NM: "Near Mint", LP: "Light Play", MP: "Moderate Play", HP: "Heavy Play", D: "Damaged",
};

const EMPTY_FORM = {
  card_name: "", set_name: "", card_number: "",
  tcg: "One Piece", rarity: "Rare", condition: "NM",
  quantity: 1, note: "",
};

export default function CollectionPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTcg, setFilterTcg] = useState("ทั้งหมด");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadCards(uid: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("collection_cards")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setCards((data as CollectionCard[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      await loadCards(session.user.id);
      setLoading(false);
    }
    init();
  }, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: CollectionCard) {
    setForm({
      card_name: c.card_name, set_name: c.set_name, card_number: c.card_number,
      tcg: c.tcg, rarity: c.rarity, condition: c.condition,
      quantity: c.quantity, note: c.note,
    });
    setEditId(c.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.card_name.trim()) { setError("กรุณากรอกชื่อการ์ด"); return; }
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      if (editId) {
        await supabase.from("collection_cards").update({ ...form }).eq("id", editId);
      } else {
        await supabase.from("collection_cards").insert({ ...form, user_id: userId });
      }
      await loadCards(userId);
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const supabase = createClient();
    await supabase.from("collection_cards").delete().eq("id", id);
    await loadCards(userId);
    setDeleting(null);
  }

  const filtered = cards.filter((c) => {
    const matchTcg = filterTcg === "ทั้งหมด" || c.tcg === filterTcg;
    const matchSearch = !search || c.card_name.toLowerCase().includes(search.toLowerCase()) ||
      c.set_name.toLowerCase().includes(search.toLowerCase());
    return matchTcg && matchSearch;
  });

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);

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
            <Link href="/profile" className="text-zinc-400 active:text-zinc-700">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <span className="text-sm font-semibold text-zinc-900">Collection</span>
          </div>
          <button onClick={openAdd} className="text-xs font-semibold text-zinc-900">+ เพิ่ม</button>
        </div>
      </header>

      {/* Stats */}
      {!showForm && (
        <div className="bg-white border-b border-zinc-100 px-4 py-3 flex items-center gap-4">
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">{cards.length}</p>
            <p className="text-[9px] text-zinc-400 tracking-wide">รายการ</p>
          </div>
          <div className="w-px h-8 bg-zinc-100" />
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">{totalCards}</p>
            <p className="text-[9px] text-zinc-400 tracking-wide">ใบรวม</p>
          </div>
          <div className="w-px h-8 bg-zinc-100" />
          {TCG_LIST.map((t) => {
            const count = cards.filter((c) => c.tcg === t).length;
            if (!count) return null;
            return (
              <div key={t} className="text-center">
                <p className="text-sm font-bold text-zinc-900">{count}</p>
                <p className="text-[9px] text-zinc-400 tracking-wide">{t.split(" ")[0]}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white border-b border-zinc-100 px-4 py-5">
          <p className="text-xs font-semibold text-zinc-900 mb-4">{editId ? "แก้ไขการ์ด" : "เพิ่มการ์ดใหม่"}</p>
          <div className="space-y-3">
            <input className="input" placeholder="ชื่อการ์ด *" value={form.card_name}
              onChange={(e) => setForm({ ...form, card_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="ชื่อเซต" value={form.set_name}
                onChange={(e) => setForm({ ...form, set_name: e.target.value })} />
              <input className="input" placeholder="เลขการ์ด เช่น OP01-001" value={form.card_number}
                onChange={(e) => setForm({ ...form, card_number: e.target.value })} />
            </div>
            {/* TCG */}
            <div>
              <p className="text-[10px] text-zinc-400 mb-1.5">TCG</p>
              <div className="flex gap-2 flex-wrap">
                {TCG_LIST.map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, tcg: t })}
                    className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${form.tcg === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* Rarity */}
            <div>
              <p className="text-[10px] text-zinc-400 mb-1.5">Rarity</p>
              <div className="flex gap-2 flex-wrap">
                {RARITY_LIST.map((r) => (
                  <button key={r} onClick={() => setForm({ ...form, rarity: r })}
                    className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${form.rarity === r ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {/* Condition */}
            <div>
              <p className="text-[10px] text-zinc-400 mb-1.5">Condition</p>
              <div className="flex gap-2 flex-wrap">
                {CONDITION_LIST.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, condition: c })}
                    className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${form.condition === c ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            {/* Quantity */}
            <div className="flex items-center gap-3">
              <p className="text-[10px] text-zinc-400 w-16">จำนวน</p>
              <div className="flex items-center gap-3 border border-zinc-200 rounded-xl px-3 py-2">
                <button onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })}
                  className="text-zinc-500 w-6 text-center font-bold">−</button>
                <span className="text-sm font-semibold w-6 text-center">{form.quantity}</span>
                <button onClick={() => setForm({ ...form, quantity: form.quantity + 1 })}
                  className="text-zinc-500 w-6 text-center font-bold">+</button>
              </div>
            </div>
            <input className="input" placeholder="หมายเหตุ (ไม่บังคับ)" value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {error && <p className="text-[11px] text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="btn-outline flex-1 py-3">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 disabled:opacity-40">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search */}
      {!showForm && (
        <div className="px-4 pt-4 pb-2 space-y-2">
          <input className="input" placeholder="ค้นหาการ์ด..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {["ทั้งหมด", ...TCG_LIST].map((t) => (
              <button key={t} onClick={() => setFilterTcg(t)}
                className={`flex-shrink-0 text-[11px] px-3 py-1.5 rounded-full border transition-colors ${filterTcg === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Card List */}
      {!showForm && (
        <div className="px-4 py-2 space-y-2">
          {filtered.length === 0 && (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm text-zinc-400 mb-1">
                {cards.length === 0 ? "ยังไม่มีการ์ดในคอลเลกชัน" : "ไม่พบการ์ดที่ค้นหา"}
              </p>
              {cards.length === 0 && (
                <button onClick={openAdd} className="mt-3 btn-primary px-6 py-2.5">เพิ่มการ์ดแรก</button>
              )}
            </div>
          )}
          {filtered.map((c) => (
            <div key={c.id} className="card px-4 py-3.5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{c.card_name}</p>
                    <span className="text-[9px] font-bold bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded flex-shrink-0">{c.condition}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    {c.set_name}{c.card_number ? ` · ${c.card_number}` : ""} · {c.tcg}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] bg-zinc-50 text-zinc-500 border border-zinc-100 px-1.5 py-0.5 rounded">{c.rarity}</span>
                    <span className="text-[10px] text-zinc-500">×{c.quantity}</span>
                    {c.note && <span className="text-[10px] text-zinc-400 truncate">{c.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <button onClick={() => openEdit(c)} className="text-[11px] text-zinc-400 underline">แก้ไข</button>
                  <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                    className="text-[11px] text-red-400 underline disabled:opacity-40">
                    {deleting === c.id ? "..." : "ลบ"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
