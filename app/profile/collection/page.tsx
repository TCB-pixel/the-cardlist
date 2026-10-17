"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useLang } from "@/lib/i18n";
import { loginHref } from "@/lib/auth-next";
import { publicError } from "@/lib/api-error";
import { TCG_LIST, tcgLabel, tcgOptions } from "@/lib/tcg";

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

const RARITY_LIST = ["Common", "Uncommon", "Rare", "Super Rare", "Secret Rare", "Special"];
const CONDITION_LIST = ["NM", "LP", "MP", "HP", "D"];

const EMPTY_FORM = {
  card_name: "", set_name: "", card_number: "",
  tcg: "One Piece", rarity: "Rare", condition: "NM",
  quantity: 1, note: "",
};

const chip = (on: boolean) =>
  `text-xs px-3 py-1.5 rounded-full transition-colors ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`;

export default function CollectionPage() {
  const router = useRouter();
  const { L } = useLang();
  const [userId, setUserId] = useState("");
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTcg, setFilterTcg] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadCards(uid: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("collection_cards")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(publicError(error, L("โหลดคอลเลกชันไม่สำเร็จ กรุณาลองใหม่", "Couldn't load your collection. Please try again.")));
      return;
    }
    setLoadError("");
    setCards((data as CollectionCard[]) ?? []);
  }

  async function init() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace(loginHref("/profile/collection")); return; }
    setUserId(session.user.id);
    await loadCards(session.user.id);
    setLoading(false);
  }

  useEffect(() => { init(); }, []);

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
    if (!form.card_name.trim()) { setError(L("กรุณากรอกชื่อการ์ด", "Please enter a card name")); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const payload = { ...form, card_name: form.card_name.trim() };
    const { error } = editId
      ? await supabase.from("collection_cards").update(payload).eq("id", editId).eq("user_id", userId)
      : await supabase.from("collection_cards").insert({ ...payload, user_id: userId });
    if (error) {
      setError(publicError(error, L("บันทึกไม่สำเร็จ กรุณาลองใหม่", "Couldn't save. Please try again.")));
      setSaving(false);
      return;
    }
    await loadCards(userId);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(c: CollectionCard) {
    if (!window.confirm(L(`ลบ "${c.card_name}" ออกจากคอลเลกชัน?`, `Remove "${c.card_name}" from your collection?`))) return;
    setDeleting(c.id);
    const supabase = createClient();
    const { error } = await supabase.from("collection_cards").delete().eq("id", c.id).eq("user_id", userId);
    if (error) window.alert(publicError(error, L("ลบไม่สำเร็จ กรุณาลองใหม่", "Couldn't delete. Please try again.")));
    else await loadCards(userId);
    setDeleting(null);
  }

  const filtered = cards.filter((c) => {
    const matchTcg = filterTcg === "all" || c.tcg === filterTcg;
    const q = search.toLowerCase();
    const matchSearch = !q || c.card_name.toLowerCase().includes(q) || c.set_name.toLowerCase().includes(q);
    return matchTcg && matchSearch;
  });

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  // เกมของร้าน + เกมเก่าที่ยังมีในข้อมูล (เช่น Dragon Ball) เพื่อให้กรองได้ครบ
  const games = [...new Set([...TCG_LIST, ...cards.map((c) => c.tcg)])];

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar
        title="Collection"
        showBack
        onBack={showForm ? () => setShowForm(false) : undefined}
        rightSlot={!loading && !loadError && !showForm && (
          <button onClick={openAdd} className="text-xs font-semibold text-zinc-900 px-2 py-2">{L("+ เพิ่ม", "+ Add")}</button>
        )}
      />

      {/* กำลังโหลด */}
      {loading && (
        <div className="px-4 py-4 space-y-2" aria-busy="true">
          <div className="h-14 bg-zinc-100 animate-pulse rounded-2xl" />
          <div className="h-11 bg-zinc-100 animate-pulse rounded-xl" />
          {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-zinc-100 animate-pulse rounded-2xl" />)}
        </div>
      )}

      {/* โหลดไม่สำเร็จ */}
      {!loading && loadError && (
        <div className="px-4 py-4">
          <div className="bg-red-50 rounded-2xl px-4 py-4">
            <p className="text-xs text-red-700 mb-3">{loadError}</p>
            <button onClick={init} className="btn-outline bg-white">{L("ลองใหม่", "Try again")}</button>
          </div>
        </div>
      )}

      {/* สรุปจำนวน */}
      {!loading && !loadError && !showForm && (
        <div className="bg-white border-b border-zinc-100 px-4 py-3 flex items-center gap-4 overflow-x-auto scrollbar-hide">
          <div className="text-center flex-shrink-0">
            <p className="text-sm font-bold text-zinc-900">{cards.length}</p>
            <p className="text-[11px] text-zinc-500">{L("รายการ", "Entries")}</p>
          </div>
          <div className="w-px h-8 bg-zinc-100 flex-shrink-0" />
          <div className="text-center flex-shrink-0">
            <p className="text-sm font-bold text-zinc-900">{totalCards}</p>
            <p className="text-[11px] text-zinc-500">{L("ใบรวม", "Total cards")}</p>
          </div>
          <div className="w-px h-8 bg-zinc-100 flex-shrink-0" />
          {games.map((t) => {
            const count = cards.filter((c) => c.tcg === t).length;
            if (!count) return null;
            return (
              <div key={t} className="text-center flex-shrink-0">
                <p className="text-sm font-bold text-zinc-900">{count}</p>
                <p className="text-[11px] text-zinc-500">{tcgLabel(t)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      {showForm && (
        <div className="bg-white border-b border-zinc-100 px-4 py-5">
          <p className="text-xs font-semibold text-zinc-900 mb-4">{editId ? L("แก้ไขการ์ด", "Edit card") : L("เพิ่มการ์ดใหม่", "Add new card")}</p>
          <div className="space-y-3">
            <input className="input" placeholder={L("ชื่อการ์ด *", "Card name *")} value={form.card_name}
              onChange={(e) => setForm({ ...form, card_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder={L("ชื่อเซต", "Set name")} value={form.set_name}
                onChange={(e) => setForm({ ...form, set_name: e.target.value })} />
              <input className="input" placeholder={L("เลขการ์ด เช่น OP01-001", "Card number, e.g. OP01-001")} value={form.card_number}
                onChange={(e) => setForm({ ...form, card_number: e.target.value })} />
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">{L("เกม", "Game")}</p>
              <div className="flex gap-2 flex-wrap">
                {tcgOptions(form.tcg).map((t) => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, tcg: t })} aria-pressed={form.tcg === t} className={chip(form.tcg === t)}>
                    {tcgLabel(t)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">Rarity</p>
              <div className="flex gap-2 flex-wrap">
                {RARITY_LIST.map((r) => (
                  <button key={r} type="button" onClick={() => setForm({ ...form, rarity: r })} aria-pressed={form.rarity === r} className={chip(form.rarity === r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">{L("สภาพ", "Condition")}</p>
              <div className="flex gap-2 flex-wrap">
                {CONDITION_LIST.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, condition: c })} aria-pressed={form.condition === c} className={chip(form.condition === c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-zinc-500 w-16">{L("จำนวน", "Quantity")}</p>
              <div className="flex items-center gap-1 border border-zinc-200 rounded-xl px-1">
                <button type="button" aria-label={L("ลดจำนวน", "Decrease")} onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })}
                  className="w-10 h-10 text-zinc-600 font-bold">−</button>
                <span className="text-sm font-semibold w-6 text-center">{form.quantity}</span>
                <button type="button" aria-label={L("เพิ่มจำนวน", "Increase")} onClick={() => setForm({ ...form, quantity: form.quantity + 1 })}
                  className="w-10 h-10 text-zinc-600 font-bold">+</button>
              </div>
            </div>
            <input className="input" placeholder={L("หมายเหตุ (ไม่บังคับ)", "Note (optional)")} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1 py-3">{L("ยกเลิก", "Cancel")}</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 disabled:opacity-40">
                {saving ? L("กำลังบันทึก...", "Saving...") : L("บันทึก", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ค้นหา + กรองเกม */}
      {!loading && !loadError && !showForm && (
        <div className="px-4 pt-4 pb-2 space-y-2">
          <input className="input" placeholder={L("ค้นหาการ์ด...", "Search cards...")} value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {["all", ...games].map((t) => (
              <button key={t} type="button" onClick={() => setFilterTcg(t)} aria-pressed={filterTcg === t}
                className={`flex-shrink-0 ${chip(filterTcg === t)}`}>
                {t === "all" ? L("ทั้งหมด", "All") : tcgLabel(t)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* รายการการ์ด */}
      {!loading && !loadError && !showForm && (
        <div className="px-4 py-2 space-y-2">
          {filtered.length === 0 && (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm text-zinc-500 mb-1">
                {cards.length === 0 ? L("ยังไม่มีการ์ดในคอลเลกชัน", "No cards in your collection yet") : L("ไม่พบการ์ดที่ค้นหา", "No matching cards")}
              </p>
              {cards.length === 0 && (
                <button type="button" onClick={openAdd} className="mt-3 btn-primary px-6 py-2.5">{L("เพิ่มการ์ดแรก", "Add your first card")}</button>
              )}
            </div>
          )}
          {filtered.map((c) => (
            <div key={c.id} className="card px-4 py-3.5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{c.card_name}</p>
                    <span className="badge-pre flex-shrink-0">{c.condition}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {[c.set_name, c.card_number, tcgLabel(c.tcg)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] bg-zinc-50 text-zinc-600 border border-zinc-100 px-1.5 py-0.5 rounded">{c.rarity}</span>
                    <span className="text-[11px] text-zinc-500">×{c.quantity}</span>
                    {c.note && <span className="text-[11px] text-zinc-500 truncate">{c.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button type="button" onClick={() => openEdit(c)} className="text-[11px] text-zinc-600 underline px-2 py-2">{L("แก้ไข", "Edit")}</button>
                  <button type="button" onClick={() => handleDelete(c)} disabled={deleting === c.id}
                    className="text-[11px] text-red-600 underline px-2 py-2 disabled:opacity-40">
                    {deleting === c.id ? "..." : L("ลบ", "Delete")}
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
