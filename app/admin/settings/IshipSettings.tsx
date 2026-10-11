"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

// ตั้งค่าการสร้างพัสดุที่ iShip: ที่อยู่ร้าน (ผู้ส่ง), ขนาด/น้ำหนักพัสดุตั้งต้น, ขนส่งตั้งต้น และสภาพแวดล้อม

const SENDER_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: "iship_sender_name", label: "ชื่อผู้ส่ง (ร้าน)", placeholder: "The Cardlist" },
  { key: "iship_sender_phone", label: "เบอร์โทรผู้ส่ง", placeholder: "08x-xxx-xxxx" },
  { key: "iship_sender_address", label: "ที่อยู่ (เลขที่ ซอย ถนน อาคาร)" },
  { key: "iship_sender_district", label: "ตำบล / แขวง" },
  { key: "iship_sender_amphure", label: "อำเภอ / เขต" },
  { key: "iship_sender_province", label: "จังหวัด" },
  { key: "iship_sender_zipcode", label: "รหัสไปรษณีย์", placeholder: "5 หลัก" },
];

const PARCEL_FIELDS: { key: string; label: string }[] = [
  { key: "iship_parcel_weight_kg", label: "น้ำหนัก (กก.)" },
  { key: "iship_parcel_width_cm", label: "กว้าง (ซม.)" },
  { key: "iship_parcel_length_cm", label: "ยาว (ซม.)" },
  { key: "iship_parcel_height_cm", label: "สูง (ซม.)" },
];

const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";
const labelCls = "text-[11px] font-semibold text-zinc-500 tracking-wide block mb-1";

export default function IshipSettings() {
  const { currentUser, can: canDo } = useAdmin();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const { data: { session } } = await createClient().auth.getSession();
    return fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch("/api/admin/settings");
        const json = await res.json();
        const s = json.settings ?? {};
        const next: Record<string, string> = {};
        for (const k of Object.keys(s)) if (k.startsWith("iship_")) next[k] = s[k] ?? "";
        setVals(next);
      } catch { /* แสดงช่องว่างต่อไป */ }
      setLoading(false);
    })();
  }, [authedFetch]);

  async function save(keys: string[], override?: Record<string, string>) {
    setSavingKey(keys[0]); setMsg(null);
    try {
      for (const key of keys) {
        const res = await authedFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ key, value: override?.[key] ?? vals[key] ?? "" }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
        if (json.value !== undefined && json.value !== null) setVals((v) => ({ ...v, [key]: json.value }));
      }
      setMsg({ ok: true, text: "บันทึกแล้ว" });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "บันทึกไม่สำเร็จ" });
    } finally {
      setSavingKey(null);
    }
  }

  async function switchEnv(next: "uat" | "prod") {
    if (next === "prod" && !window.confirm(
      "สลับเป็น \"ของจริง\"?\n\nหลังจากนี้ทุกครั้งที่กดสร้างพัสดุ จะ**หักเครดิตจริง**ที่ iShip และออกเลขพัสดุจริง\n\nตรวจให้แน่ใจว่าที่อยู่ผู้ส่งและขนาดพัสดุถูกต้องแล้ว"
    )) return;
    setVals((v) => ({ ...v, iship_env: next }));
    setSavingKey("iship_env"); setMsg(null);
    try {
      const res = await authedFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ key: "iship_env", value: next }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สลับไม่สำเร็จ");
      setMsg({ ok: true, text: next === "prod" ? "สลับเป็นของจริงแล้ว — การสร้างพัสดุจะหักเครดิตจริง" : "สลับเป็นโหมดทดสอบแล้ว" });
    } catch (e: any) {
      setVals((v) => ({ ...v, iship_env: next === "prod" ? "uat" : "prod" }));
      setMsg({ ok: false, text: e?.message ?? "สลับไม่สำเร็จ" });
    } finally {
      setSavingKey(null);
    }
  }

  const env = vals.iship_env === "prod" ? "prod" : "uat";
  const isOwner = currentUser.role === "owner";
  const disabled = loading || !canDo("orders:edit");

  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-5 mt-4">
      <h2 className="text-sm font-semibold text-zinc-900">สร้างพัสดุที่ iShip</h2>
      <p className="text-[11px] text-zinc-400 mt-0.5 mb-4">
        ตั้งค่าที่ใช้ตอนกด "สร้างพัสดุที่ iShip" ในหน้าออเดอร์ — ข้อมูลผู้ส่งต้องกรอกให้ครบก่อนใช้งาน
      </p>

      {/* สภาพแวดล้อม */}
      <div className={`rounded-xl border px-4 py-3 mb-5 ${env === "prod" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className={`text-xs font-semibold ${env === "prod" ? "text-red-700" : "text-amber-800"}`}>
              {env === "prod" ? "🔴 โหมดของจริง — หักเครดิตจริง" : "🟡 โหมดทดสอบ (UAT) — ไม่หักเครดิตจริง"}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {env === "prod" ? "ใช้ app.iship.cloud" : "ใช้ app-uat.iship.cloud · เลขพัสดุที่ได้เป็นของทดสอบ ส่งของจริงไม่ได้"}
            </p>
          </div>
          <button onClick={() => switchEnv(env === "prod" ? "uat" : "prod")}
            disabled={disabled || !isOwner || savingKey === "iship_env"}
            title={isOwner ? "" : "เฉพาะเจ้าของร้านเท่านั้น"}
            className="text-xs font-semibold border border-zinc-300 bg-white rounded-lg px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40">
            {env === "prod" ? "กลับไปโหมดทดสอบ" : "สลับเป็นของจริง"}
          </button>
        </div>
        {!isOwner && <p className="text-[10px] text-zinc-500 mt-2">การสลับโหมดทำได้เฉพาะเจ้าของร้าน (owner)</p>}
      </div>

      {/* แจ้งลูกค้าอัตโนมัติ */}
      <div className="rounded-xl border border-zinc-200 px-4 py-3 mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-900">
            {vals.iship_auto_ship === "on" ? "✅ เปิด: สร้างพัสดุแล้วเปลี่ยนเป็น \"จัดส่งแล้ว\" และแจ้งลูกค้าทันที" : "⏸ ปิด: สร้างพัสดุแล้วเก็บเลขไว้เฉย ๆ ไม่แจ้งลูกค้า"}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">ช่วงทดสอบให้ปิดไว้ — เปิดเมื่อพร้อมใช้งานจริง (มีผลเฉพาะโหมดของจริง)</p>
        </div>
        <button disabled={disabled || savingKey !== null}
          onClick={async () => {
            const next = vals.iship_auto_ship === "on" ? "off" : "on";
            setVals((v) => ({ ...v, iship_auto_ship: next }));
            await save(["iship_auto_ship"], { iship_auto_ship: next });
          }}
          className="text-xs font-semibold border border-zinc-300 bg-white rounded-lg px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40">
          {vals.iship_auto_ship === "on" ? "ปิด" : "เปิด"}
        </button>
      </div>

      {/* ผู้ส่ง */}
      <p className="text-[10px] font-semibold text-zinc-400 tracking-widest mb-2">ที่อยู่ผู้ส่ง (ร้านของคุณ)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {SENDER_FIELDS.map((f) => (
          <div key={f.key} className={f.key === "iship_sender_address" ? "md:col-span-2" : ""}>
            <label className={labelCls}>{f.label}</label>
            <input className={inputCls} placeholder={f.placeholder} value={vals[f.key] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} disabled={disabled} />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-400 mb-4">
        ตำบล/อำเภอ/จังหวัด ต้องสะกดตรงกับฐานข้อมูลที่อยู่ของ iShip (ตามไฟล์ชีตที่ iShip แนบไว้ในเอกสาร API)
      </p>

      {/* พัสดุตั้งต้น */}
      <p className="text-[10px] font-semibold text-zinc-400 tracking-widest mb-2">ขนาดพัสดุตั้งต้น (ใช้กับทุกออเดอร์)</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {PARCEL_FIELDS.map((f) => (
          <div key={f.key}>
            <label className={labelCls}>{f.label}</label>
            <input className={inputCls} inputMode="decimal" value={vals[f.key] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} disabled={disabled} />
          </div>
        ))}
      </div>
      <div className="mb-4 max-w-xs">
        <label className={labelCls}>ขนส่งตั้งต้น (รหัสของ iShip)</label>
        <input className={inputCls} placeholder="KerryExpress" value={vals.iship_default_courier ?? ""}
          onChange={(e) => setVals((v) => ({ ...v, iship_default_courier: e.target.value }))} disabled={disabled} />
        <p className="text-[10px] text-zinc-400 mt-1">เช่น KerryExpress, THP_eParcelX (ไปรษณีย์ไทย EMS) — แอดมินเปลี่ยนรายออเดอร์ได้ตอนสร้าง</p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => save([...SENDER_FIELDS, ...PARCEL_FIELDS].map((f) => f.key).concat("iship_default_courier"))}
          disabled={disabled || savingKey !== null}
          className="bg-zinc-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40">
          {savingKey ? "กำลังบันทึก..." : "บันทึกการตั้งค่า iShip"}
        </button>
        {msg && <span className={`text-[11px] font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.ok ? "✓ " : "✕ "}{msg.text}</span>}
      </div>
    </div>
  );
}
