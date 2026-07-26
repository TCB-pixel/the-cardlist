"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

type NewsPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  tag: string;
  image_url: string | null;
  published_at: string;
};

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tag: string;
  image_url: string;
  published_at: string;
};

const EMPTY: FormState = { title: "", slug: "", excerpt: "", content: "", tag: "NEWS", image_url: "", published_at: new Date().toISOString().split("T")[0] };

const TAG_STYLE: Record<string, string> = {
  TOURNAMENT: "bg-red-50 text-red-700", RELEASE: "bg-blue-50 text-blue-700",
  NEWS: "bg-zinc-100 text-zinc-600", "DECK GUIDE": "bg-green-50 text-green-700",
};

function slugify(text: string) { return text.toLowerCase().replace(/[^a-z0-9฀-๿]+/g, "-").replace(/^-|-$/g, ""); }

export default function AdminNewsPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const res = await authedFetch("/api/admin/news");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setPosts(data.news ?? []);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setSaveError("รูปต้องไม่เกิน 3MB"); return; }
    setUploadingImg(true);
    setSaveError("");
    const ext = file.name.split(".").pop();
    const path = `news/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("banners").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) {
      setSaveError("อัปโหลดรูปไม่สำเร็จ: " + uploadErr.message);
      setUploadingImg(false);
      return;
    }
    const { data } = supabase.storage.from("banners").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl + `?t=${Date.now()}` }));
    setUploadingImg(false);
  }

  function openAdd() { setEditing(null); setForm(EMPTY); setPreview(false); setSaveError(""); setShowModal(true); }
  function openEdit(p: NewsPost) {
    setEditing(p);
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt ?? "", content: p.content,
      tag: p.tag, image_url: p.image_url ?? "", published_at: p.published_at.split("T")[0],
    });
    setPreview(false); setSaveError(""); setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      setSaveError("กรอกชื่อบทความและเนื้อหาให้ครบ");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const payload = { ...form, slug: form.slug || slugify(form.title) };
      const res = editing
        ? await authedFetch("/api/admin/news", { method: "PATCH", body: JSON.stringify({ id: editing.id, ...payload }) })
        : await authedFetch("/api/admin/news", { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setShowModal(false);
      await load();
    } catch (e: any) {
      setSaveError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await authedFetch("/api/admin/news", { method: "DELETE", body: JSON.stringify({ id: deleteId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      setDeleteId(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "ลบไม่สำเร็จ");
      setDeleteId(null);
    }
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-zinc-400">{loading ? "กำลังโหลด..." : `${posts.length} บทความ`}</span>
        <button onClick={openAdd} className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
          <span className="text-base leading-none font-light">+</span> เขียนบทความ
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-red-600">{error}</p>
          <button onClick={load} className="text-[11px] font-semibold text-red-700 underline flex-shrink-0">ลองใหม่</button>
        </div>
      )}

      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {["ชื่อบทความ", "Tag", "Slug", "วันที่เผยแพร่", ""].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">ยังไม่มีบทความ</td></tr>
            ) : (
              posts.map((p) => (
                <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                  <td className="px-5 py-3.5">
                    <p className="text-xs font-semibold text-zinc-900">{p.title}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{p.excerpt}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${TAG_STYLE[p.tag] ?? "bg-zinc-100 text-zinc-600"}`}>{p.tag}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[10px] font-mono text-zinc-400">/{p.slug}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{new Date(p.published_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">แก้ไข</button>
                      <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-400 border border-red-100 rounded-lg px-2.5 py-1 hover:bg-red-50">ลบ</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไขบทความ" : "เขียนบทความใหม่"}</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => setPreview(!preview)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${preview ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
                  {preview ? "แก้ไข" : "Preview"}
                </button>
                <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg leading-none">✕</button>
              </div>
            </div>

            {preview ? (
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {form.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt="" className="w-full h-40 object-cover rounded-xl mb-4" />
                )}
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${TAG_STYLE[form.tag] ?? "bg-zinc-100 text-zinc-600"}`}>{form.tag}</span>
                <h1 className="text-xl font-bold text-zinc-900 mt-3 mb-2">{form.title || "ชื่อบทความ"}</h1>
                <p className="text-sm text-zinc-500 mb-4">{form.excerpt}</p>
                <hr className="border-zinc-100 mb-4" />
                <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{form.content || "เนื้อหาบทความ..."}</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {saveError && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-red-600">{saveError}</p>
                  </div>
                )}
                <div>
                  <label className={labelCls}>ชื่อบทความ *</label>
                  <input className={inputCls} placeholder="ชื่อบทความ" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Tag</label>
                    <select className={inputCls} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
                      {["NEWS", "TOURNAMENT", "RELEASE", "DECK GUIDE"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>วันที่เผยแพร่</label>
                    <input type="date" className={inputCls} value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Slug (URL)</label>
                  <input className={inputCls + " font-mono text-xs"} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>รูปปก</label>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
                  <div className="flex items-center gap-3">
                    {form.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.image_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-zinc-200 flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-zinc-50 border border-dashed border-zinc-200 flex-shrink-0" />
                    )}
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImg}
                      className="text-xs border border-zinc-200 rounded-xl px-3 py-2 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
                      {uploadingImg ? "⏳ กำลังอัปโหลด..." : form.image_url ? "เปลี่ยนรูป" : "📸 อัปโหลดรูปปก"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>บทย่อ</label>
                  <textarea rows={2} className={inputCls} placeholder="สรุปบทความสั้นๆ" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>เนื้อหา *</label>
                  <textarea rows={10} className={inputCls} placeholder="เขียนเนื้อหาบทความที่นี่..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                </div>
              </div>
            )}

            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : editing ? "บันทึก" : "เผยแพร่บทความ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl w-80 mx-4 p-6 text-center">
            <p className="text-sm font-bold text-zinc-900 mb-2">ยืนยันการลบบทความ?</p>
            <p className="text-xs text-zinc-400 mb-5">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-zinc-200 text-xs py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 text-white text-xs py-2.5 rounded-xl">ลบบทความ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
