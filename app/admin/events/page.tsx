"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import Image from "next/image";

type EventType = "meetup" | "tournament" | "sale";

type Event = {
  id: string;
  title: string;
  location: string;
  date: string;
  date_end: string | null;
  time: string;
  tcg: string;
  format: string | null;
  max_slots: number;
  booked_slots: number;
  description: string | null;
  event_type: EventType;
  image_url: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<EventType, string> = {
  meetup: "Meet Up / งานขาย",
  tournament: "Tournament",
  sale: "Sale Event",
};

const TYPE_COLOR: Record<EventType, string> = {
  meetup: "bg-blue-50 text-blue-700",
  tournament: "bg-purple-50 text-purple-700",
  sale: "bg-green-50 text-green-700",
};

const TCG_OPTIONS = ["Pokemon", "One Piece", "MTG", "Dragon Ball", "Mixed", "Other"];

const MONTHS = [
  { v: "01", l: "มกราคม" }, { v: "02", l: "กุมภาพันธ์" }, { v: "03", l: "มีนาคม" },
  { v: "04", l: "เมษายน" }, { v: "05", l: "พฤษภาคม" }, { v: "06", l: "มิถุนายน" },
  { v: "07", l: "กรกฎาคม" }, { v: "08", l: "สิงหาคม" }, { v: "09", l: "กันยายน" },
  { v: "10", l: "ตุลาคม" }, { v: "11", l: "พฤศจิกายน" }, { v: "12", l: "ธันวาคม" },
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

function toISO(day: string, month: string, year: string) {
  if (!day || !month || !year || year.length !== 4) return "";
  return `${year}-${month}-${day}`;
}

function fromISO(iso: string) {
  if (!iso) return { day: "", month: "", year: "" };
  const [y, m, d] = iso.split("-");
  return { day: d, month: m, year: y };
}

type DateParts = { day: string; month: string; year: string };

function DatePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const parts = fromISO(value);
  const [day, setDay] = useState(parts.day);
  const [month, setMonth] = useState(parts.month);
  const [year, setYear] = useState(parts.year);

  useEffect(() => {
    const iso = toISO(day, month, year);
    if (iso) onChange(iso);
  }, [day, month, year]);

  const cls = "bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";

  return (
    <div>
      <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        <select className={cls} value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">วัน</option>
          {DAYS.map((d) => <option key={d} value={d}>{parseInt(d)}</option>)}
        </select>
        <select className={cls} value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">เดือน</option>
          {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <input type="number" className={cls} placeholder="ปี ค.ศ."
          value={year} onChange={(e) => setYear(e.target.value)} min="2024" max="2099" />
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  title: "",
  location: "",
  date: "",
  date_end: "",
  time: "10:00",
  tcg: "Pokemon",
  format: "",
  max_slots: 0,
  description: "",
  event_type: "meetup" as EventType,
  image_url: "",
};

export default function AdminEventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Image upload
  const imgRef = useRef<HTMLInputElement>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("date", { ascending: true });
    setEvents(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImgFile(null);
    setImgPreview(null);
    setError("");
    setShowModal(true);
  }

  function openEdit(ev: Event) {
    setEditing(ev);
    setForm({
      title: ev.title,
      location: ev.location ?? "",
      date: ev.date,
      date_end: ev.date_end ?? "",
      time: ev.time?.slice(0, 5) ?? "10:00",
      tcg: ev.tcg ?? "Pokemon",
      format: ev.format ?? "",
      max_slots: ev.max_slots ?? 0,
      description: ev.description ?? "",
      event_type: (ev.event_type as EventType) ?? "meetup",
      image_url: ev.image_url ?? "",
    });
    setImgFile(null);
    setImgPreview(ev.image_url ?? null);
    setError("");
    setShowModal(true);
  }

  async function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
  }

  async function uploadImage(): Promise<string | null> {
    if (!imgFile) return form.image_url || null;
    setImgUploading(true);
    try {
      const ext = imgFile.name.split(".").pop();
      const path = `events/event_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("banners").upload(path, imgFile, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      setError("อัพโหลดรูปไม่สำเร็จ: " + err.message);
      return null;
    } finally {
      setImgUploading(false);
    }
  }

  async function handleSave() {
    if (!form.title || !form.date) { setError("กรุณากรอกชื่องานและวันที่"); return; }
    setSaving(true);
    setError("");

    const uploadedUrl = await uploadImage();
    if (imgFile && !uploadedUrl) { setSaving(false); return; }

    const payload = {
      title: form.title,
      location: form.location,
      date: form.date,
      date_end: form.date_end || null,
      time: form.time,
      tcg: form.tcg,
      format: form.format || null,
      max_slots: form.event_type === "tournament" ? form.max_slots : 0,
      description: form.description || null,
      event_type: form.event_type,
      image_url: uploadedUrl,
    };

    if (editing) {
      const { error: err } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from("events").insert({ ...payload, booked_slots: 0 });
      if (err) { setError(err.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowModal(false);
    await load();
  }

  async function handleDelete(id: string) {
    await supabase.from("events").delete().eq("id", id);
    setDeleteId(null);
    await load();
  }

  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5";

  function formatDate(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-zinc-400">{events.length} อีเวนต์</span>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-700">
          <span className="text-base leading-none">+</span> สร้างอีเวนต์
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {events.length === 0 && (
            <div className="bg-white border border-zinc-100 rounded-2xl p-10 text-center">
              <p className="text-sm text-zinc-400">ยังไม่มีอีเวนต์ กด "+ สร้างอีเวนต์" ได้เลย</p>
            </div>
          )}
          {events.map((ev) => {
            const type = (ev.event_type ?? "meetup") as EventType;
            const pct = ev.max_slots > 0 ? Math.round((ev.booked_slots / ev.max_slots) * 100) : 0;
            return (
              <div key={ev.id} className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
                {ev.image_url && (
                  <div className="relative h-28 w-full">
                    <Image src={ev.image_url} alt={ev.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-bold text-zinc-900">{ev.title}</h3>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[type]}`}>{TYPE_LABEL[type]}</span>
                        <span className="text-[9px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{ev.tcg}</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        📍 {ev.location} · 📅 {formatDate(ev.date)}{ev.date_end ? ` – ${formatDate(ev.date_end)}` : ""} · 🕐 {ev.time?.slice(0, 5)} น.
                      </p>
                      {ev.description && <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{ev.description}</p>}
                      {type === "tournament" && ev.max_slots > 0 && (
                        <div className="mt-2 max-w-xs">
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] text-zinc-500">{ev.max_slots - ev.booked_slots} เหลือ / {ev.max_slots}</span>
                            <span className="text-[10px] text-zinc-400">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-zinc-900"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      {type !== "tournament" && (
                        <div className="mt-2 flex gap-2">
                          <span className="text-[9px] bg-zinc-100 text-zinc-500 px-2 py-1 rounded-lg">🟢 General (ฟรี)</span>
                          <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">🥇 Priority ฿500</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(ev)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50">แก้ไข</button>
                      <button onClick={() => setDeleteId(ev.id)} className="text-xs text-red-400 border border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50">ลบ</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-zinc-900">{editing ? "แก้ไขอีเวนต์" : "สร้างอีเวนต์ใหม่"}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 text-lg">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* ประเภทงาน */}
              <div>
                <label className={labelCls}>ประเภทงาน *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(TYPE_LABEL) as [EventType, string][]).map(([key, label]) => (
                    <button key={key} type="button"
                      onClick={() => setForm({ ...form, event_type: key })}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${form.event_type === key ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>ชื่องาน *</label>
                <input className={inputCls} placeholder="เช่น Card Event @ Siam Discovery"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div>
                <label className={labelCls}>สถานที่</label>
                <input className={inputCls} placeholder="เช่น Siam Discovery"
                  value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>

              <div>
                <label className={labelCls}>คำอธิบาย</label>
                <textarea rows={2} className={inputCls} placeholder="รายละเอียดงาน"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* วันที่ — dropdown */}
              <div className="grid grid-cols-2 gap-3">
                <DatePicker label="วันเริ่มงาน *" value={form.date}
                  onChange={(v) => setForm({ ...form, date: v })} />
                <DatePicker label={`วันสิ้นสุด${form.event_type !== "tournament" ? " (ถ้ามี)" : ""}`}
                  value={form.date_end ?? ""}
                  onChange={(v) => setForm({ ...form, date_end: v })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>เวลาเริ่ม</label>
                  <input type="time" className={inputCls} value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>TCG</label>
                  <select className={inputCls} value={form.tcg}
                    onChange={(e) => setForm({ ...form, tcg: e.target.value })}>
                    {TCG_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {form.event_type === "tournament" && (
                <div className="grid grid-cols-2 gap-3 bg-purple-50 rounded-xl p-3">
                  <div>
                    <label className={labelCls}>รูปแบบการแข่ง</label>
                    <input className={inputCls} placeholder="Swiss, Bo3..."
                      value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>จำนวนที่นั่งสูงสุด</label>
                    <input type="number" className={inputCls} value={form.max_slots}
                      onChange={(e) => setForm({ ...form, max_slots: Number(e.target.value) })} />
                  </div>
                </div>
              )}

              {form.event_type !== "tournament" && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-[11px] text-blue-700 font-semibold mb-1">บัตรที่จะแสดงอัตโนมัติ:</p>
                  <p className="text-[10px] text-blue-600">🟢 General — ลงทะเบียนฟรี</p>
                  <p className="text-[10px] text-blue-600">🥇 Priority Guest — ฿500</p>
                </div>
              )}

              {/* รูปภาพ Banner */}
              <div>
                <label className={labelCls}>รูปภาพ Banner</label>
                <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImgChange} />
                {imgPreview ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-zinc-100">
                      <Image src={imgPreview} alt="banner" fill className="object-cover" />
                    </div>
                    <button onClick={() => imgRef.current?.click()}
                      className="w-full border border-zinc-200 rounded-xl py-2 text-xs text-zinc-500 hover:bg-zinc-50">
                      เปลี่ยนรูป
                    </button>
                  </div>
                ) : (
                  <button onClick={() => imgRef.current?.click()}
                    className="w-full border-2 border-dashed border-zinc-200 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-zinc-400 transition-colors">
                    <span className="text-2xl">🖼️</span>
                    <p className="text-xs text-zinc-400">กดเพื่ออัพโหลดรูป Banner</p>
                    <p className="text-[10px] text-zinc-300">JPG, PNG, WEBP</p>
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-[11px] text-red-600">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-zinc-200 text-xs font-semibold text-zinc-700 py-2.5 rounded-xl">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving || imgUploading}
                className="flex-1 bg-zinc-900 text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50">
                {imgUploading ? "กำลังอัพโหลดรูป..." : saving ? "กำลังบันทึก..." : editing ? "บันทึก" : "สร้างอีเวนต์"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl w-80 mx-4 p-6 text-center">
            <p className="text-sm font-bold text-zinc-900 mb-2">ยืนยันการลบอีเวนต์?</p>
            <p className="text-xs text-zinc-400 mb-5">ข้อมูลการลงทะเบียนทั้งหมดจะถูกลบด้วย</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-zinc-200 text-xs py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 text-white text-xs py-2.5 rounded-xl">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
