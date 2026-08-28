"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";
import type { Artist, ArtistCard, ArtistCategory } from "@/lib/types";

type ArtistRow = Artist & { cardCount: number };

type ArtistForm = {
  name: string; bio: string; avatar_url: string;
  instagram_url: string; facebook_url: string; x_url: string;
  order: number; active: boolean;
};
type CardForm = {
  artist_id: string; category_id: string; name: string; description: string;
  story: string; significance: string; how_to_get: string;
  image_url: string; rarity: string; limited_count: string; collection: string;
  release_year: string; order: number; active: boolean;
};

const EMPTY_ARTIST: ArtistForm = {
  name: "", bio: "", avatar_url: "", instagram_url: "", facebook_url: "", x_url: "",
  order: 1, active: true,
};
const EMPTY_CARD: CardForm = {
  artist_id: "", category_id: "", name: "", description: "",
  story: "", significance: "", how_to_get: "", image_url: "",
  rarity: "", limited_count: "", collection: "", release_year: "", order: 1, active: true,
};

const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

export default function AdminArtistsPage() {
  const supabase = createClient();
  const { can: canDo } = useAdmin();

  const [tab, setTab] = useState<"cards" | "artists" | "categories">("cards");
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [cards, setCards] = useState<ArtistCard[]>([]);
  const [categories, setCategories] = useState<ArtistCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [artistModal, setArtistModal] = useState(false);
  const [editingArtist, setEditingArtist] = useState<ArtistRow | null>(null);
  const [artistForm, setArtistForm] = useState<ArtistForm>(EMPTY_ARTIST);

  const [cardModal, setCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<ArtistCard | null>(null);
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);

  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: "artist" | "card" | "category"; id: string; label: string } | null
  >(null);
  const [filterArtist, setFilterArtist] = useState("");

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, cRes, catRes] = await Promise.all([
        authedFetch("/api/admin/artists"),
        authedFetch("/api/admin/artist-cards"),
        authedFetch("/api/admin/artist-categories"),
      ]);
      const [a, c, cat] = await Promise.all([aRes.json(), cRes.json(), catRes.json()]);
      if (!aRes.ok) throw new Error(a.error || "โหลดข้อมูลศิลปินไม่สำเร็จ");
      if (!cRes.ok) throw new Error(c.error || "โหลดข้อมูลการ์ดไม่สำเร็จ");
      if (!catRes.ok) throw new Error(cat.error || "โหลดหมวดหมู่ไม่สำเร็จ");
      setArtists(a.artists ?? []);
      setCards(c.cards ?? []);
      setCategories(cat.categories ?? []);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const visibleCards = useMemo(
    () => (filterArtist ? cards.filter((c) => c.artist_id === filterArtist) : cards),
    [cards, filterArtist]
  );

  // ── อัปโหลดรูปเข้า bucket "banners" (ใช้ร่วมกับ news/events) ──
  async function uploadImage(file: File, folder: string): Promise<string | null> {
    if (file.size > 3 * 1024 * 1024) { setSaveError("รูปต้องไม่เกิน 3MB"); return null; }
    setUploading(true);
    setSaveError("");
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("banners")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setSaveError("อัปโหลดรูปไม่สำเร็จ: " + upErr.message);
      setUploading(false);
      return null;
    }
    const { data } = supabase.storage.from("banners").getPublicUrl(path);
    setUploading(false);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  // ── ศิลปิน ──
  function openAddArtist() {
    setEditingArtist(null); setArtistForm({ ...EMPTY_ARTIST, order: artists.length + 1 });
    setSaveError(""); setArtistModal(true);
  }
  function openEditArtist(a: ArtistRow) {
    setEditingArtist(a);
    setArtistForm({
      name: a.name, bio: a.bio ?? "", avatar_url: a.avatar_url ?? "",
      instagram_url: a.instagram_url ?? "", facebook_url: a.facebook_url ?? "",
      x_url: a.x_url ?? "", order: a.order, active: a.active,
    });
    setSaveError(""); setArtistModal(true);
  }
  async function saveArtist() {
    if (!artistForm.name.trim()) { setSaveError("กรอกชื่อศิลปิน"); return; }
    setSaving(true); setSaveError("");
    try {
      const res = await authedFetch("/api/admin/artists", {
        method: editingArtist ? "PATCH" : "POST",
        body: JSON.stringify(editingArtist ? { id: editingArtist.id, ...artistForm } : artistForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setArtistModal(false);
      await load();
    } catch (e: any) {
      setSaveError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally { setSaving(false); }
  }

  // ── การ์ด ──
  function openAddCard() {
    if (artists.length === 0) { setError("เพิ่มศิลปินก่อนอย่างน้อย 1 คน จึงจะเพิ่มการ์ดได้"); return; }
    setEditingCard(null);
    setCardForm({ ...EMPTY_CARD, artist_id: filterArtist || artists[0].id, order: cards.length + 1 });
    setSaveError(""); setCardModal(true);
  }
  function openEditCard(c: ArtistCard) {
    setEditingCard(c);
    setCardForm({
      artist_id: c.artist_id, category_id: c.category_id ?? "", name: c.name,
      description: c.description ?? "", story: c.story ?? "",
      significance: c.significance ?? "", how_to_get: c.how_to_get ?? "",
      image_url: c.image_url ?? "", rarity: c.rarity ?? "",
      limited_count: c.limited_count?.toString() ?? "", collection: c.collection ?? "",
      release_year: c.release_year?.toString() ?? "", order: c.order, active: c.active,
    });
    setSaveError(""); setCardModal(true);
  }
  async function saveCard() {
    if (!cardForm.name.trim()) { setSaveError("กรอกชื่อการ์ด"); return; }
    if (!cardForm.artist_id) { setSaveError("เลือกศิลปิน"); return; }
    setSaving(true); setSaveError("");
    try {
      const res = await authedFetch("/api/admin/artist-cards", {
        method: editingCard ? "PATCH" : "POST",
        body: JSON.stringify(editingCard ? { id: editingCard.id, ...cardForm } : cardForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setCardModal(false);
      await load();
    } catch (e: any) {
      setSaveError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally { setSaving(false); }
  }

  // ── หมวดหมู่ ──
  async function addCategory() {
    if (!newCategory.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await authedFetch("/api/admin/artist-categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategory, order: categories.length + 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เพิ่มหมวดหมู่ไม่สำเร็จ");
      setNewCategory("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "เพิ่มหมวดหมู่ไม่สำเร็จ");
    } finally { setSaving(false); }
  }
  async function toggleCategory(c: ArtistCategory) {
    await authedFetch("/api/admin/artist-categories", {
      method: "PATCH", body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    await load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    const url = confirmDelete.kind === "artist" ? "/api/admin/artists"
      : confirmDelete.kind === "card" ? "/api/admin/artist-cards"
      : "/api/admin/artist-categories";
    try {
      const res = await authedFetch(url, { method: "DELETE", body: JSON.stringify({ id: confirmDelete.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "ลบไม่สำเร็จ");
      setConfirmDelete(null);
    }
  }

  const canEdit = canDo("artists:edit");
  const canCreate = canDo("artists:create");
  const canDelete = canDo("artists:delete");

  const TABS = [
    { key: "cards" as const, label: `การ์ด (${cards.length})` },
    { key: "artists" as const, label: `ศิลปิน (${artists.length})` },
    { key: "categories" as const, label: `หมวดหมู่ (${categories.length})` },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-xs px-3.5 py-1.5 rounded-lg transition-colors ${
                tab === t.key ? "bg-white text-zinc-900 font-semibold shadow-sm" : "text-zinc-500"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {canCreate && tab !== "categories" && (
          <button onClick={tab === "cards" ? openAddCard : openAddArtist}
            className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
            <span className="text-base leading-none font-light">+</span>
            {tab === "cards" ? "เพิ่มการ์ด" : "เพิ่มศิลปิน"}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-red-600">{error}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      {/* ─── การ์ด ─── */}
      {tab === "cards" && (
        <>
          {artists.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-zinc-400">กรองตามศิลปิน</span>
              <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)}
                className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 outline-none">
                <option value="">ทั้งหมด</option>
                {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {["การ์ด", "ศิลปิน", "หมวดหมู่", "คอลเลคชัน", "สถานะ", ""].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
                ) : visibleCards.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีการ์ด — กด &quot;เพิ่มการ์ด&quot; เพื่อเริ่มต้น</td></tr>
                ) : visibleCards.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-12 rounded-md bg-zinc-100 overflow-hidden flex-shrink-0">
                          {c.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900">{c.name}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {[c.rarity, c.limited_count != null ? `LTD ${c.limited_count}` : null]
                              .filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-600">{artistById.get(c.artist_id)?.name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded tracking-widest bg-zinc-100 text-zinc-600">
                        {categoryById.get(c.category_id ?? "")?.name ?? "ไม่มีหมวดหมู่"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-zinc-500">
                      {[c.collection, c.release_year].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${
                        c.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-400"}`}>
                        {c.active ? "แสดง" : "ซ่อน"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        {canEdit && <button onClick={() => openEditCard(c)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">แก้ไข</button>}
                        {canDelete && <button onClick={() => setConfirmDelete({ kind: "card", id: c.id, label: c.name })} className="text-xs text-red-400 border border-red-100 rounded-lg px-2.5 py-1 hover:bg-red-50">ลบ</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── ศิลปิน ─── */}
      {tab === "artists" && (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["ศิลปิน", "จำนวนการ์ด", "โซเชียล", "สถานะ", ""].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
              ) : artists.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีศิลปิน — กด &quot;เพิ่มศิลปิน&quot; เพื่อเริ่มต้น</td></tr>
              ) : artists.map((a) => (
                <tr key={a.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-zinc-400">
                        {a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.avatar_url} alt={a.name} className="w-full h-full object-cover" />
                        ) : a.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900">{a.name}</p>
                        <p className="text-[10px] font-mono text-zinc-400">/{a.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{a.cardCount} ใบ</td>
                  <td className="px-5 py-3.5 text-[10px] text-zinc-400">
                    {[a.instagram_url && "IG", a.facebook_url && "FB", a.x_url && "X"].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${
                      a.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-400"}`}>
                      {a.active ? "แสดง" : "ซ่อน"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      {canEdit && <button onClick={() => openEditArtist(a)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">แก้ไข</button>}
                      {canDelete && <button onClick={() => setConfirmDelete({ kind: "artist", id: a.id, label: `${a.name} (การ์ด ${a.cardCount} ใบจะถูกลบด้วย)` })} className="text-xs text-red-400 border border-red-100 rounded-lg px-2.5 py-1 hover:bg-red-50">ลบ</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── หมวดหมู่ ─── */}
      {tab === "categories" && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-5">
          {canCreate && (
            <div className="flex gap-2 mb-4">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
                placeholder="ชื่อหมวดหมู่ใหม่ เช่น One Piece, Original Art"
                className={inputCls} />
              <button onClick={addCategory} disabled={saving || !newCategory.trim()}
                className="bg-zinc-900 text-white text-xs font-semibold px-4 rounded-xl hover:bg-zinc-700 disabled:opacity-40 flex-shrink-0">
                เพิ่ม
              </button>
            </div>
          )}
          {loading ? (
            <p className="text-xs text-zinc-400 text-center py-8">กำลังโหลด...</p>
          ) : categories.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-8">ยังไม่มีหมวดหมู่</p>
          ) : (
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border border-zinc-100 rounded-xl px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900">{c.name}</p>
                    <p className="text-[10px] font-mono text-zinc-400">/{c.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-zinc-400">
                      ใช้อยู่ {cards.filter((k) => k.category_id === c.id).length} ใบ
                    </span>
                    {canEdit && (
                      <button onClick={() => toggleCategory(c)}
                        className={`text-[9px] font-bold px-2 py-1 rounded tracking-widest ${
                          c.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-400"}`}>
                        {c.active ? "แสดง" : "ซ่อน"}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setConfirmDelete({ kind: "category", id: c.id, label: c.name })}
                        className="text-xs text-red-400 border border-red-100 rounded-lg px-2.5 py-1 hover:bg-red-50">ลบ</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Modal: ศิลปิน ─── */}
      {artistModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setArtistModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">{editingArtist ? "แก้ไขศิลปิน" : "เพิ่มศิลปิน"}</h2>
              <button onClick={() => setArtistModal(false)} className="text-zinc-400 text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className={labelCls}>ชื่อศิลปิน *</label>
                <input value={artistForm.name} onChange={(e) => setArtistForm({ ...artistForm, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>คำอธิบาย / ประวัติ</label>
                <textarea rows={3} value={artistForm.bio} onChange={(e) => setArtistForm({ ...artistForm, bio: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>รูปโปรไฟล์</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 overflow-hidden flex-shrink-0">
                    {artistForm.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artistForm.avatar_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <input type="file" accept="image/*" disabled={uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadImage(f, "artists");
                      if (url) setArtistForm((s) => ({ ...s, avatar_url: url }));
                    }}
                    className="text-[11px] text-zinc-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={labelCls}>Instagram</label>
                  <input value={artistForm.instagram_url} onChange={(e) => setArtistForm({ ...artistForm, instagram_url: e.target.value })} placeholder="https://" className={inputCls} /></div>
                <div><label className={labelCls}>Facebook</label>
                  <input value={artistForm.facebook_url} onChange={(e) => setArtistForm({ ...artistForm, facebook_url: e.target.value })} placeholder="https://" className={inputCls} /></div>
                <div><label className={labelCls}>X</label>
                  <input value={artistForm.x_url} onChange={(e) => setArtistForm({ ...artistForm, x_url: e.target.value })} placeholder="https://" className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>ลำดับการแสดง</label>
                  <input type="number" value={artistForm.order} onChange={(e) => setArtistForm({ ...artistForm, order: Number(e.target.value) })} className={inputCls} /></div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-600">
                    <input type="checkbox" checked={artistForm.active} onChange={(e) => setArtistForm({ ...artistForm, active: e.target.checked })} />
                    แสดงบนหน้าเว็บ
                  </label>
                </div>
              </div>
              {saveError && <p className="text-[11px] text-red-600">{saveError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2">
              <button onClick={() => setArtistModal(false)} className="text-xs text-zinc-500 border border-zinc-200 rounded-xl px-4 py-2">ยกเลิก</button>
              <button onClick={saveArtist} disabled={saving || uploading}
                className="bg-zinc-900 text-white text-xs font-semibold px-5 py-2 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: การ์ด ─── */}
      {cardModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCardModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">{editingCard ? "แก้ไขการ์ด" : "เพิ่มการ์ด"}</h2>
              <button onClick={() => setCardModal(false)} className="text-zinc-400 text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>ศิลปิน *</label>
                  <select value={cardForm.artist_id} onChange={(e) => setCardForm({ ...cardForm, artist_id: e.target.value })} className={inputCls}>
                    {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>หมวดหมู่</label>
                  <select value={cardForm.category_id} onChange={(e) => setCardForm({ ...cardForm, category_id: e.target.value })} className={inputCls}>
                    <option value="">— ไม่ระบุ —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>ชื่อการ์ด *</label>
                <input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>คำอธิบายสั้น</label>
                <textarea rows={2} value={cardForm.description} onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                  placeholder="สรุปสั้นๆ ว่าการ์ดใบนี้คืออะไร" className={inputCls} />
              </div>

              {/* หัวข้อเล่าเรื่อง — เว้นว่างได้ ถ้าไม่กรอกจะไม่แสดงบนหน้าเว็บ */}
              <div className="border-t border-zinc-100 pt-3 space-y-3">
                <p className="text-[10px] text-zinc-400">
                  3 ช่องนี้เว้นว่างได้ — กรอกช่องไหนจะโชว์เฉพาะช่องนั้นในป๊อปอัปของหน้าเว็บ
                </p>
                <div>
                  <label className={labelCls}>✨ เรื่องราวเบื้องหลัง</label>
                  <textarea rows={3} value={cardForm.story} onChange={(e) => setCardForm({ ...cardForm, story: e.target.value })}
                    placeholder="แรงบันดาลใจ ที่มาของภาพ ความหมายของสัญลักษณ์ในการ์ด" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>⭐ ทำไมการ์ดใบนี้ถึงพิเศษ</label>
                  <textarea rows={3} value={cardForm.significance} onChange={(e) => setCardForm({ ...cardForm, significance: e.target.value })}
                    placeholder="เช่น ใบแรกของซีรีส์ ทำเฉพาะงาน มีลายเซ็นศิลปิน" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>🎟️ วิธีได้มา / ที่มา</label>
                  <textarea rows={3} value={cardForm.how_to_get} onChange={(e) => setCardForm({ ...cardForm, how_to_get: e.target.value })}
                    placeholder="เช่น แจกในงาน SIAM PARAGON 2026 / แถมกับสินค้า" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>รูปการ์ด</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded-md bg-zinc-100 overflow-hidden flex-shrink-0">
                    {cardForm.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cardForm.image_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <input type="file" accept="image/*" disabled={uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadImage(f, "artist-cards");
                      if (url) setCardForm((s) => ({ ...s, image_url: url }));
                    }}
                    className="text-[11px] text-zinc-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>ความหายาก</label>
                  <input value={cardForm.rarity} onChange={(e) => setCardForm({ ...cardForm, rarity: e.target.value })} placeholder="SR / SSR / Promo" className={inputCls} /></div>
                <div><label className={labelCls}>จำนวนจำกัด (ใบ)</label>
                  <input type="number" value={cardForm.limited_count} onChange={(e) => setCardForm({ ...cardForm, limited_count: e.target.value })} placeholder="100" className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>คอลเลคชัน</label>
                  <input value={cardForm.collection} onChange={(e) => setCardForm({ ...cardForm, collection: e.target.value })} placeholder="SIAM PARAGON 2026" className={inputCls} /></div>
                <div><label className={labelCls}>ปีที่วางจำหน่าย</label>
                  <input type="number" value={cardForm.release_year} onChange={(e) => setCardForm({ ...cardForm, release_year: e.target.value })} placeholder="2026" className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>ลำดับการแสดง</label>
                  <input type="number" value={cardForm.order} onChange={(e) => setCardForm({ ...cardForm, order: Number(e.target.value) })} className={inputCls} /></div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-600">
                    <input type="checkbox" checked={cardForm.active} onChange={(e) => setCardForm({ ...cardForm, active: e.target.checked })} />
                    แสดงบนหน้าเว็บ
                  </label>
                </div>
              </div>
              {saveError && <p className="text-[11px] text-red-600">{saveError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2">
              <button onClick={() => setCardModal(false)} className="text-xs text-zinc-500 border border-zinc-200 rounded-xl px-4 py-2">ยกเลิก</button>
              <button onClick={saveCard} disabled={saving || uploading}
                className="bg-zinc-900 text-white text-xs font-semibold px-5 py-2 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ยืนยันการลบ ─── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">ยืนยันการลบ</h2>
            <p className="text-xs text-zinc-500 mb-5">ต้องการลบ &quot;{confirmDelete.label}&quot; ใช่ไหม? การลบนี้ย้อนกลับไม่ได้</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="text-xs text-zinc-500 border border-zinc-200 rounded-xl px-4 py-2">ยกเลิก</button>
              <button onClick={doDelete} className="bg-red-600 text-white text-xs font-semibold px-5 py-2 rounded-xl hover:bg-red-700">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
