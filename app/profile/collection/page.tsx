"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { useLang } from "@/lib/i18n";
import { loginHref } from "@/lib/auth-next";
import { publicError } from "@/lib/api-error";
import { TCG_LIST, tcgLabel, tcgOptions } from "@/lib/tcg";
import { toCsv, parseCsv } from "@/lib/collection-csv";
import CardSearch from "@/components/CardSearch";
import SetProgress, { OwnedRef } from "@/components/SetProgress";

type Status = "own" | "want" | "trade";
type CatalogRef = { image_url: string | null; game: string; lang: string; set_code: string; card_number: string };
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
  status: Status;
  language: string;
  variant: string;
  created_at: string;
  card_id: string | null;
  card: CatalogRef | null;
};

const RARITY_LIST = ["Common", "Uncommon", "Rare", "Super Rare", "Secret Rare", "Special"];
const CONDITION_LIST = ["NM", "LP", "MP", "HP", "D"];
const LANG_LIST = ["", "th", "en", "ja"];
const LANG_LABEL: Record<string, string> = { th: "TH", en: "EN", ja: "JP" };
const TABS = ["own", "want", "trade", "sets"] as const;
type Tab = (typeof TABS)[number];

const EMPTY_FORM = {
  card_name: "", set_name: "", card_number: "",
  tcg: "One Piece", rarity: "Rare", condition: "NM",
  quantity: 1, note: "",
  status: "own" as Status, language: "", variant: "normal",
  card_id: null as string | null,
};

const SELECT = "*, card:tcg_cards(image_url, game, lang, set_code, card_number)";

const chip = (on: boolean) =>
  `text-xs px-3 py-1.5 rounded-full transition-colors ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`;

export default function CollectionPage() {
  const router = useRouter();
  const { L } = useLang();
  const [userId, setUserId] = useState("");
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("own");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTcg, setFilterTcg] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const TAB_LABEL: Record<Tab, string> = {
    own: L("ที่มี", "Owned"),
    want: L("อยากได้", "Wishlist"),
    trade: L("พร้อมแลก", "For trade"),
    sets: L("ครบเซต", "Sets"),
  };

  async function loadCards(uid: string) {
    const { data, error } = await createClient()
      .from("collection_cards")
      .select(SELECT)
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(publicError(error, L("โหลดคอลเลกชันไม่สำเร็จ กรุณาลองใหม่", "Couldn't load your collection. Please try again.")));
      return;
    }
    setLoadError("");
    setCards((data as unknown as CollectionCard[]) ?? []);
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
    setForm({ ...EMPTY_FORM, status: tab === "sets" ? "own" : tab });
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: CollectionCard) {
    setForm({
      card_name: c.card_name, set_name: c.set_name, card_number: c.card_number,
      tcg: c.tcg, rarity: c.rarity, condition: c.condition,
      quantity: c.quantity, note: c.note,
      status: c.status, language: c.language, variant: c.variant,
      card_id: c.card_id,
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
    if (tab !== "sets" && tab !== form.status) setTab(form.status);
  }

  async function handleDelete(c: CollectionCard) {
    if (!window.confirm(L(`ลบ "${c.card_name}" ออกจากรายการ?`, `Remove "${c.card_name}"?`))) return;
    setDeleting(c.id);
    const { error } = await createClient().from("collection_cards").delete().eq("id", c.id).eq("user_id", userId);
    if (error) window.alert(publicError(error, L("ลบไม่สำเร็จ กรุณาลองใหม่", "Couldn't delete. Please try again.")));
    else await loadCards(userId);
    setDeleting(null);
  }

  // ย้ายสถานะเร็ว ๆ เช่น ได้การ์ดที่อยากได้แล้ว → "ที่มี"
  async function moveTo(c: CollectionCard, status: Status) {
    const { error } = await createClient().from("collection_cards").update({ status }).eq("id", c.id).eq("user_id", userId);
    if (error) window.alert(publicError(error, L("ย้ายไม่สำเร็จ กรุณาลองใหม่", "Couldn't move. Please try again.")));
    else await loadCards(userId);
  }

  async function addWant(c: { id: string; name: string; card_number: string; set_name: string; rarity: string | null; lang: string; game: string }) {
    const { error } = await createClient().from("collection_cards").insert({
      user_id: userId, card_id: c.id, card_name: c.name, set_name: c.set_name, card_number: c.card_number,
      tcg: c.game, rarity: c.rarity ?? "Rare", language: c.lang, status: "want", quantity: 1, condition: "NM",
    });
    if (error) { window.alert(publicError(error, L("เพิ่มไม่สำเร็จ กรุณาลองใหม่", "Couldn't add. Please try again."))); return; }
    await loadCards(userId);
  }

  function exportCsv() {
    const csv = toCsv(cards.map((c) => ({ ...c, quantity: String(c.quantity) })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cardlist-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    setImportMsg("");
    if (file.size > 1_000_000) { setImportMsg(L("ไฟล์ใหญ่เกิน 1 MB", "File is larger than 1 MB")); return; }
    const { rows, skipped } = parseCsv(await file.text());
    if (!rows.length) { setImportMsg(L("ไม่พบแถวที่นำเข้าได้ — ตรวจหัวคอลัมน์ให้ตรงกับไฟล์ที่ส่งออก", "No rows to import — check the column headers match an exported file")); return; }
    if (!window.confirm(L(`นำเข้า ${rows.length} รายการ?`, `Import ${rows.length} rows?`))) return;
    setImporting(true);
    const supabase = createClient();
    // ผูกกับฐานข้อมูลการ์ดเมื่อเกม + เลขการ์ด (+ ภาษา) ตรงกันแค่ใบเดียว
    const nums = [...new Set(rows.map((r) => r.card_number).filter(Boolean))];
    const matches = new Map<string, string | null>();
    for (let i = 0; i < nums.length; i += 200) {
      const { data } = await supabase.from("tcg_cards").select("id, game, lang, card_number").eq("variant", "normal").in("card_number", nums.slice(i, i + 200));
      for (const m of data ?? []) {
        for (const k of [`${m.game}|${m.lang}|${m.card_number}`, `${m.game}||${m.card_number}`]) {
          matches.set(k, matches.has(k) ? null : m.id); // ซ้ำหลายใบ = ไม่ผูก
        }
      }
    }
    const payload = rows.map((r) => ({
      ...r, user_id: userId,
      card_id: (r.card_number && matches.get(`${r.tcg}|${r.language}|${r.card_number}`)) || null,
    }));
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase.from("collection_cards").insert(payload.slice(i, i + 200));
      if (error) {
        setImportMsg(publicError(error, L(`นำเข้าได้ ${i} รายการ แล้วเกิดข้อผิดพลาด กรุณาลองใหม่`, `Imported ${i} rows, then failed. Please try again.`)));
        setImporting(false);
        await loadCards(userId);
        return;
      }
    }
    setImportMsg(L(`นำเข้าแล้ว ${rows.length} รายการ${skipped ? ` · ข้าม ${skipped} แถว` : ""}`, `Imported ${rows.length} rows${skipped ? ` · skipped ${skipped}` : ""}`));
    setImporting(false);
    await loadCards(userId);
  }

  const inTab = cards.filter((c) => c.status === tab);
  const filtered = inTab.filter((c) => {
    const matchTcg = filterTcg === "all" || c.tcg === filterTcg;
    const q = search.toLowerCase();
    const matchSearch = !q || c.card_name.toLowerCase().includes(q) || c.set_name.toLowerCase().includes(q) || c.card_number.toLowerCase().includes(q);
    return matchTcg && matchSearch;
  });
  const count = (s: Status) => cards.filter((c) => c.status === s).reduce((n, c) => n + c.quantity, 0);
  // เกมของร้าน + เกมเก่าที่ยังมีในข้อมูล (เช่น Dragon Ball) เพื่อให้กรองได้ครบ
  const games = [...new Set([...TCG_LIST, ...cards.map((c) => c.tcg)])];
  const ready = !loading && !loadError;

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar
        title="Collection"
        showBack
        onBack={showForm ? () => setShowForm(false) : undefined}
        rightSlot={ready && !showForm && (
          <button type="button" onClick={openAdd} className="text-xs font-semibold text-zinc-900 px-2 py-2">{L("+ เพิ่ม", "+ Add")}</button>
        )}
      />

      {loading && (
        <div className="px-4 py-4 space-y-2" aria-busy="true">
          <div className="h-14 bg-zinc-100 animate-pulse rounded-2xl" />
          <div className="h-11 bg-zinc-100 animate-pulse rounded-xl" />
          {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-zinc-100 animate-pulse rounded-2xl" />)}
        </div>
      )}

      {!loading && loadError && (
        <div className="px-4 py-4">
          <div className="bg-red-50 rounded-2xl px-4 py-4">
            <p className="text-xs text-red-700 mb-3">{loadError}</p>
            <button type="button" onClick={init} className="btn-outline bg-white">{L("ลองใหม่", "Try again")}</button>
          </div>
        </div>
      )}

      {/* แท็บ + จำนวน */}
      {ready && !showForm && (
        <div className="bg-white border-b border-zinc-100 px-4 pt-3 pb-3">
          <div className="grid grid-cols-4 gap-1 bg-zinc-100 rounded-xl p-1" role="tablist">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`py-2 rounded-lg text-xs transition-colors ${tab === t ? "bg-white text-zinc-900 font-semibold" : "text-zinc-600"}`}>
                {TAB_LABEL[t]}
                {t !== "sets" && <span className="block text-[11px] text-zinc-500 font-normal">{count(t)} {L("ใบ", "cards")}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      {showForm && (
        <div className="bg-white border-b border-zinc-100 px-4 py-5">
          <p className="text-xs font-semibold text-zinc-900 mb-4">{editId ? L("แก้ไขการ์ด", "Edit card") : L("เพิ่มการ์ดใหม่", "Add new card")}</p>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">{L("เก็บไว้ใน", "Save to")}</p>
              <div className="flex gap-2 flex-wrap">
                {(["own", "want", "trade"] as Status[]).map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, status: s })} aria-pressed={form.status === s} className={chip(form.status === s)}>
                    {TAB_LABEL[s]}
                  </button>
                ))}
              </div>
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
            <CardSearch game={form.tcg} onSelect={(c) => setForm({
              ...form, card_id: c.id, card_name: c.name, set_name: c.set_name, card_number: c.card_number,
              rarity: c.rarity ?? form.rarity, language: c.lang, variant: c.variant,
            })} />
            <input className="input" placeholder={L("ชื่อการ์ด *", "Card name *")} value={form.card_name}
              onChange={(e) => setForm({ ...form, card_name: e.target.value, card_id: null })} />
            {form.card_id && <p className="text-[11px] text-green-700">{L("ผูกกับฐานข้อมูลการ์ดแล้ว — นับใน % ครบเซต", "Linked to the card database — counts toward set completion")}</p>}
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder={L("ชื่อเซต", "Set name")} value={form.set_name}
                onChange={(e) => setForm({ ...form, set_name: e.target.value })} />
              <input className="input" placeholder={L("เลขการ์ด เช่น OP01-001", "Card number, e.g. OP01-001")} value={form.card_number}
                onChange={(e) => setForm({ ...form, card_number: e.target.value, card_id: null })} />
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">{L("ภาษาการ์ด", "Card language")}</p>
              <div className="flex gap-2 flex-wrap">
                {LANG_LIST.map((l) => (
                  <button key={l || "none"} type="button" onClick={() => setForm({ ...form, language: l })} aria-pressed={form.language === l} className={chip(form.language === l)}>
                    {l ? LANG_LABEL[l] : L("ไม่ระบุ", "Not set")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">Rarity</p>
              <div className="flex gap-2 flex-wrap">
                {(RARITY_LIST.includes(form.rarity) ? RARITY_LIST : [...RARITY_LIST, form.rarity]).map((r) => (
                  <button key={r} type="button" onClick={() => setForm({ ...form, rarity: r })} aria-pressed={form.rarity === r} className={chip(form.rarity === r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <input className="input" placeholder={L("Variant เช่น normal, parallel, foil", "Variant, e.g. normal, parallel, foil")} value={form.variant}
              onChange={(e) => setForm({ ...form, variant: e.target.value })} aria-label="Variant" />
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
                <button type="button" aria-label={L("เพิ่มจำนวน", "Increase")} onClick={() => setForm({ ...form, quantity: Math.min(9999, form.quantity + 1) })}
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

      {/* ครบเซต */}
      {ready && !showForm && tab === "sets" && (
        <div className="px-4 py-4">
          <SetProgress owned={cards as OwnedRef[]} onWant={addWant} />
        </div>
      )}

      {/* ค้นหา + กรองเกม */}
      {ready && !showForm && tab !== "sets" && (
        <div className="px-4 pt-4 pb-2 space-y-2">
          <input className="input" placeholder={L("ค้นหาในรายการนี้...", "Search this list...")} value={search}
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
      {ready && !showForm && tab !== "sets" && (
        <div className="px-4 py-2 space-y-2">
          {filtered.length === 0 && (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm text-zinc-500 mb-1">
                {inTab.length > 0 ? L("ไม่พบการ์ดที่ค้นหา", "No matching cards")
                  : tab === "own" ? L("ยังไม่มีการ์ดในคอลเลกชัน", "No cards in your collection yet")
                  : tab === "want" ? L("ยังไม่มีการ์ดที่อยากได้", "Your wishlist is empty")
                  : L("ยังไม่มีการ์ดที่พร้อมแลก", "No cards marked for trade")}
              </p>
              {inTab.length === 0 && (
                <button type="button" onClick={openAdd} className="mt-3 btn-primary px-6 py-2.5">{L("เพิ่มการ์ด", "Add a card")}</button>
              )}
            </div>
          )}
          {filtered.map((c) => (
            <div key={c.id} className="card px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                {c.card?.image_url && (
                  <img src={c.card.image_url} alt={c.card_name} loading="lazy" className="w-12 h-16 object-cover rounded bg-zinc-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{c.card_name}</p>
                    {tab !== "want" && <span className="badge-pre flex-shrink-0">{c.condition}</span>}
                    {c.language && <span className="badge-pre flex-shrink-0">{LANG_LABEL[c.language]}</span>}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {[c.set_name, c.card_number, tcgLabel(c.tcg), c.variant !== "normal" ? c.variant : ""].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] bg-zinc-50 text-zinc-600 border border-zinc-100 px-1.5 py-0.5 rounded">{c.rarity}</span>
                    <span className="text-[11px] text-zinc-500">×{c.quantity}</span>
                    {c.note && <span className="text-[11px] text-zinc-500 truncate">{c.note}</span>}
                  </div>
                  {tab === "want" && (
                    <button type="button" onClick={() => moveTo(c, "own")} className="mt-2 text-[11px] text-zinc-700 border border-zinc-200 rounded-full px-3 py-1.5">
                      {L("ได้แล้ว → ย้ายไปที่มี", "Got it → move to owned")}
                    </button>
                  )}
                  {tab === "own" && (
                    <button type="button" onClick={() => moveTo(c, "trade")} className="mt-2 text-[11px] text-zinc-700 border border-zinc-200 rounded-full px-3 py-1.5">
                      {L("ตั้งเป็นพร้อมแลก", "Mark for trade")}
                    </button>
                  )}
                  {tab === "trade" && (
                    <button type="button" onClick={() => moveTo(c, "own")} className="mt-2 text-[11px] text-zinc-700 border border-zinc-200 rounded-full px-3 py-1.5">
                      {L("ไม่แลกแล้ว", "No longer for trade")}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => openEdit(c)} className="text-[11px] text-zinc-600 underline px-2 py-2">{L("แก้ไข", "Edit")}</button>
                  <button type="button" onClick={() => handleDelete(c)} disabled={deleting === c.id}
                    className="text-[11px] text-red-600 underline px-2 py-2 disabled:opacity-40">
                    {deleting === c.id ? "..." : L("ลบ", "Delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* นำเข้า / ส่งออก CSV */}
          <div className="pt-4 flex gap-2">
            <button type="button" onClick={exportCsv} disabled={!cards.length} className="btn-outline flex-1 disabled:opacity-40">{L("ส่งออก CSV", "Export CSV")}</button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={importing} className="btn-outline flex-1 disabled:opacity-40">
              {importing ? L("กำลังนำเข้า...", "Importing...") : L("นำเข้า CSV", "Import CSV")}
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importCsv(f); }} />
          </div>
          {importMsg && <p className="text-[11px] text-zinc-600" role="status">{importMsg}</p>}
          <p className="text-[11px] text-zinc-500">{L("ไฟล์ CSV เปิดใน Excel / Google Sheets ได้ · ไม่มีข้อมูลราคา", "CSV opens in Excel / Google Sheets · no price data")}</p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
