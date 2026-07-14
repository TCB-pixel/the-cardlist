"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { TIER_LABEL, TIER_COLOR, TierKey } from "@/lib/tiers";

const TIERS: (TierKey | "ทั้งหมด")[] = ["ทั้งหมด", "bronze", "silver", "gold", "platinum"];

type Member = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  tier: TierKey;
  totalSpend: number;
  points: number;
  orders: number;
  joined: string;
};

function formatJoined(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminMembersPage() {
  const supabase = createClient();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterTier, setFilterTier] = useState<TierKey | "ทั้งหมด">("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // แนบ access_token ไปกับทุก request ให้ /api/admin/members ตรวจสิทธิ์ได้
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
      const res = await authedFetch("/api/admin/members");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setMembers(data.members ?? []);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  const filtered = members.filter((m) => {
    if (filterTier !== "ทั้งหมด" && m.tier !== filterTier) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.username.toLowerCase().includes(q) && !m.displayName.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function openDetail(m: Member) {
    setSelected(m);
    setEditPoints(String(m.points));
    setSaveError("");
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await authedFetch("/api/admin/members", {
        method: "PATCH",
        body: JSON.stringify({ id: selected.id, points: Number(editPoints) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setMembers((prev) => prev.map((m) => m.id === selected.id ? { ...m, points: Number(editPoints) } : m));
      setSelected(null);
    } catch (e: any) {
      setSaveError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 w-64">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#a1a1aa" strokeWidth="1.2"/><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <input className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 flex-1 outline-none" placeholder="ค้นหาสมาชิก..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {TIERS.map((t) => (
            <button key={t} onClick={() => setFilterTier(t)}
              className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition-colors ${filterTier === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 bg-white"}`}>
              {t === "ทั้งหมด" ? "ทั้งหมด" : TIER_LABEL[t]}
            </button>
          ))}
        </div>
        <button onClick={load} className="text-[11px] text-zinc-400 border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50">รีเฟรช</button>
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} สมาชิก</span>
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
              {["สมาชิก", "Tier", "ยอดสะสม", "Points", "Orders", "สมัครวันที่", ""].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-zinc-400">ไม่พบสมาชิก</td></tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (m.displayName[0] ?? "?").toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900">{m.displayName}</p>
                        <p className="text-[10px] text-zinc-400">@{m.username || "—"}{m.email ? ` · ${m.email}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: TIER_COLOR[m.tier] }}></span>
                      <span className="text-xs font-semibold" style={{ color: TIER_COLOR[m.tier] }}>{TIER_LABEL[m.tier]}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-zinc-900">฿{m.totalSpend.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{m.points.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{m.orders}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{formatJoined(m.joined)}</td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => openDetail(m)} className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50">จัดการ</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">จัดการสมาชิก</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-400 text-lg">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold overflow-hidden">
                  {selected.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (selected.displayName[0] ?? "?").toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{selected.displayName}</p>
                  <p className="text-xs text-zinc-400">@{selected.username || "—"}{selected.email ? ` · ${selected.email}` : ""}</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1">Tier (คำนวณจากยอดซื้อสะสม — แก้ตรงไม่ได้)</label>
                <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: TIER_COLOR[selected.tier] }}></span>
                    <span className="text-sm font-semibold" style={{ color: TIER_COLOR[selected.tier] }}>{TIER_LABEL[selected.tier]}</span>
                  </div>
                  <span className="text-[11px] text-zinc-400">฿{selected.totalSpend.toLocaleString()} สะสม</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1">Points</label>
                <input type="number" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} />
              </div>

              {saveError && <p className="text-[11px] text-red-600">{saveError}</p>}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setSelected(null)} className="flex-1 border border-zinc-200 text-xs py-2.5 rounded-xl">ยกเลิก</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 bg-zinc-900 text-white text-xs py-2.5 rounded-xl disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
