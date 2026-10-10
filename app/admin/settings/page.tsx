"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

export default function AdminSettingsPage() {
  const { can: canDo } = useAdmin();
  const [fbUrl, setFbUrl] = useState("");
  const [lineIds, setLineIds] = useState("");
  const [lineStaff, setLineStaff] = useState<{ name: string; email: string; line_user_id: string }[]>([]);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalMembers: 0, fbClicked: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await authedFetch("/api/admin/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      setFbUrl(json.settings?.facebook_page_url ?? "");
      setLineIds(json.settings?.order_notify_line_ids ?? "");
      setLineStaff(json.lineStaff ?? []);
      setStats(json.stats);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  async function saveKey(key: string, value: string) {
    setSaving(true); setError(""); setSaved(false); setSavedKey(null);
    try {
      const res = await authedFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setSaved(true);
      setSavedKey(key);
      setTimeout(() => { setSaved(false); setSavedKey(null); }, 2500);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const pct = stats.totalMembers ? (stats.fbClicked / stats.totalMembers) * 100 : 0;
  const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-sm font-semibold text-zinc-900">ตั้งค่าเว็บไซต์</h1>
        <p className="text-[11px] text-zinc-400 mt-0.5">แก้ได้ทันที ไม่ต้อง deploy ใหม่</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-[11px] text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white border border-zinc-100 rounded-2xl p-5">
        <p className="text-[10px] font-semibold text-zinc-400 tracking-widest mb-3">เพจ FACEBOOK</p>

        <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
          ลิงก์เพจ The Cardlist
        </label>
        <input value={fbUrl} onChange={(e) => setFbUrl(e.target.value)}
          placeholder="https://www.facebook.com/yourpage" className={inputCls} disabled={loading} />
        <p className="text-[10px] text-zinc-400 mt-1.5">
          เว้นว่าง = ซ่อนการ์ดชวนกดไลค์ทั้งเว็บ · ใส่ลิงก์แล้วการ์ดจะขึ้นในหน้าโปรไฟล์และหน้าอีเวนต์ทันที
        </p>

        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => saveKey("facebook_page_url", fbUrl)} disabled={saving || loading || !canDo("news:edit")}
            className="bg-zinc-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          {saved && savedKey === "facebook_page_url" && <span className="text-[11px] text-green-600 font-semibold">✓ บันทึกแล้ว</span>}
        </div>

        {/* สถิติ */}
        <div className="mt-5 pt-5 border-t border-zinc-100">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-semibold text-zinc-400 tracking-widest">สมาชิกที่กดไปเพจแล้ว</p>
            <p className="text-xs text-zinc-900">
              <span className="text-xl font-bold">{stats.fbClicked}</span>
              <span className="text-zinc-400"> / {stats.totalMembers} คน</span>
            </p>
          </div>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#1877F2] rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3 leading-relaxed">
            ⚠️ ตัวเลขนี้คือ &quot;จำนวนคนที่กดลิงก์ไปเพจ&quot; ไม่ใช่ &quot;จำนวนคนที่กดไลค์จริง&quot; —
            Facebook ไม่เปิด API ให้เว็บภายนอกตรวจสอบการกดไลค์ได้ตั้งแต่ปี 2018
            ยอดไลค์จริงต้องดูจากหลังบ้านเพจเอง
          </p>
        </div>
      </div>

      {/* ── แจ้งเตือนคำสั่งซื้อทาง LINE ── */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 mt-4">
        <p className="text-[10px] font-semibold text-zinc-400 tracking-widest mb-3">แจ้งเตือนคำสั่งซื้อทาง LINE</p>

        <label className="text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1.5">
          LINE ID ของคนที่จะรับแจ้งเตือน
        </label>
        <textarea value={lineIds} onChange={(e) => setLineIds(e.target.value)} rows={2}
          placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx, Uyyyy..." className={inputCls} disabled={loading} />
        <p className="text-[10px] text-zinc-400 mt-1.5">
          ใส่ได้หลายคน คั่นด้วยจุลภาค · เว้นว่าง = ไม่แจ้งเตือนใครเลย ·
          ทุกครั้งที่ลูกค้าชำระเงินสำเร็จ ระบบจะส่งสรุปคำสั่งซื้อไปให้ทาง LINE
        </p>

        {lineStaff.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-zinc-500 mb-1.5">ทีมงานที่ผูก LINE ไว้แล้ว — กดเพื่อเพิ่ม</p>
            <div className="flex flex-wrap gap-2">
              {lineStaff.map((st) => {
                const already = lineIds.includes(st.line_user_id);
                return (
                  <button key={st.line_user_id} disabled={already}
                    onClick={() => setLineIds((v) => (v.trim() ? `${v.trim()},${st.line_user_id}` : st.line_user_id))}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                      already ? "border-green-200 bg-green-50 text-green-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}>
                    {already ? "✓ " : "+ "}{st.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3 leading-relaxed">
            ยังไม่มีทีมงานคนไหนผูกบัญชี LINE ไว้ — ให้คนที่จะรับแจ้งเตือน
            <span className="font-semibold"> เพิ่มบัญชี LINE ทางการของร้านเป็นเพื่อนก่อน </span>
            แล้วเข้าเว็บไซต์ล็อกอินด้วย LINE หนึ่งครั้ง ชื่อจะขึ้นมาให้กดเลือกตรงนี้เอง
            (LINE ส่งข้อความหาคนที่ยังไม่ได้เป็นเพื่อนกับบัญชีทางการไม่ได้)
          </p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => saveKey("order_notify_line_ids", lineIds)} disabled={saving || loading || !canDo("news:edit")}
            className="bg-zinc-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          {saved && savedKey === "order_notify_line_ids" && (
            <span className="text-[11px] text-green-600 font-semibold">✓ บันทึกแล้ว</span>
          )}
        </div>
      </div>
    </div>
  );
}
