"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

// หน้าต่างสร้างพัสดุที่ iShip สำหรับ 1 ออเดอร์
// ลำดับบังคับ: โหลดข้อมูล → แอดมินตรวจ/แก้ที่อยู่ → เช็คราคา (ไม่หักเงิน) → กดสร้าง (หักเครดิต)
// เปลี่ยนที่อยู่หลังเช็คราคาแล้ว ต้องเช็คราคาใหม่ — กันสร้างด้วยที่อยู่คนละชุดกับที่เห็นราคา

type Party = { name: string; phone: string; address: string; district: string; amphure: string; province: string; zipcode: string };
type Prep = {
  already: { tracking: string; env: string | null; at: string | null } | null;
  env: "uat" | "prod";
  courier: string;
  parcel: { weightKg: number; widthCm: number; lengthCm: number; heightCm: number };
  senderMissing: string[];
  recipient: Party;
};

const FIELDS: { key: keyof Party; label: string; wide?: boolean }[] = [
  { key: "name", label: "ชื่อผู้รับ" },
  { key: "phone", label: "เบอร์โทร" },
  { key: "address", label: "ที่อยู่ (เลขที่ ซอย ถนน)", wide: true },
  { key: "district", label: "ตำบล / แขวง" },
  { key: "amphure", label: "อำเภอ / เขต" },
  { key: "province", label: "จังหวัด" },
  { key: "zipcode", label: "รหัสไปรษณีย์" },
];

const inputCls = "w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400";

export default function IshipDialog({
  orderId, orderRef, onClose, onCreated,
}: { orderId: string; orderRef: string; onClose: () => void; onCreated: (tracking: string, env: string) => void }) {
  const [prep, setPrep] = useState<Prep | null>(null);
  const [dst, setDst] = useState<Party | null>(null);
  const [courier, setCourier] = useState("");
  const [price, setPrice] = useState<{ total: number; remote: number } | null>(null);
  const [busy, setBusy] = useState<"load" | "price" | "create" | null>("load");
  const [err, setErr] = useState<{ text: string; unsure?: boolean; problems?: string[] } | null>(null);

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
        const res = await authedFetch(`/api/admin/orders/iship?orderId=${encodeURIComponent(orderId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
        setPrep(json); setDst(json.recipient); setCourier(json.courier);
      } catch (e: any) {
        setErr({ text: e?.message ?? "โหลดข้อมูลไม่สำเร็จ" });
      } finally {
        setBusy(null);
      }
    })();
  }, [authedFetch, orderId]);

  function edit(key: keyof Party, value: string) {
    setDst((d) => (d ? { ...d, [key]: value } : d));
    setPrice(null); // แก้ข้อมูลแล้วราคาเดิมใช้ไม่ได้ ต้องเช็คใหม่
  }

  async function post(action: "price" | "create") {
    return authedFetch("/api/admin/orders/iship", {
      method: "POST",
      body: JSON.stringify({ action, orderId, courier, recipient: dst, confirmEnv: prep?.env }),
    });
  }

  async function doPrice() {
    setBusy("price"); setErr(null);
    try {
      const res = await post("price");
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.error ?? "เช็คราคาไม่สำเร็จ"), { problems: json.problems });
      setPrice({ total: json.totalPrice, remote: json.remoteArea });
    } catch (e: any) {
      setErr({ text: e?.message ?? "เช็คราคาไม่สำเร็จ", problems: e?.problems });
    } finally { setBusy(null); }
  }

  async function doCreate() {
    if (!prep || !price) return;
    const real = prep.env === "prod";
    const msg = real
      ? `สร้างพัสดุจริงที่ iShip?\n\nขนส่ง: ${courier}\nค่าส่ง: ฿${price.total}\nจะหักเครดิตจริง และยกเลิกผ่านระบบนี้ไม่ได้`
      : `สร้างพัสดุ "ทดสอบ" ที่ iShip (UAT)?\n\nไม่หักเครดิตจริง เลขที่ได้ส่งของจริงไม่ได้`;
    if (!window.confirm(msg)) return;

    setBusy("create"); setErr(null);
    try {
      const res = await post("create");
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.error ?? "สร้างพัสดุไม่สำเร็จ"), { unsure: json.unsure, problems: json.problems });
      onCreated(json.tracking, json.env);
    } catch (e: any) {
      setErr({ text: e?.message ?? "สร้างพัสดุไม่สำเร็จ", unsure: e?.unsure, problems: e?.problems });
    } finally { setBusy(null); }
  }

  const real = prep?.env === "prod";
  const blocked = !!prep && (prep.senderMissing.length > 0 || !!prep.already);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">สร้างพัสดุที่ iShip · #{orderRef}</h2>
          <button onClick={onClose} disabled={busy === "create"} className="text-zinc-400 text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {busy === "load" && <p className="text-xs text-zinc-400 text-center py-8">กำลังโหลด...</p>}

          {prep && (
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${real ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-800 border border-amber-100"}`}>
              {real ? "🔴 โหมดของจริง — การสร้างจะหักเครดิตจริง" : "🟡 โหมดทดสอบ (UAT) — ไม่หักเครดิตจริง เลขที่ได้ส่งของจริงไม่ได้"}
            </div>
          )}

          {prep?.already && (
            <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-green-700">✅ ออเดอร์นี้สร้างพัสดุแล้ว</p>
              <p className="text-xs text-green-700 mt-1 font-mono">{prep.already.tracking}</p>
              <p className="text-[10px] text-green-600 mt-1">สร้างซ้ำไม่ได้ เพื่อกันหักเครดิตสองรอบ</p>
            </div>
          )}

          {prep && prep.senderMissing.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700">ยังไม่ได้ตั้งค่าที่อยู่ผู้ส่ง (ร้าน)</p>
              <p className="text-[11px] text-red-600 mt-1">ไปกรอกที่ ตั้งค่า → "สร้างพัสดุที่ iShip" ก่อน ({prep.senderMissing.length} ช่องที่ยังว่าง)</p>
            </div>
          )}

          {prep && dst && !blocked && (
            <>
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 tracking-widest mb-1">ตรวจที่อยู่ผู้รับ</p>
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-2">
                  ที่อยู่จากหน้าชำระเงินไม่แยกตำบล/อำเภอชัดเจน ระบบเดาให้ — <b>ตรวจให้ตรงกับชื่อใน iShip ก่อนกดสร้าง</b> ถ้าผิดอาจส่งไม่ถึงและเสียเครดิตเปล่า
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FIELDS.map((f) => (
                    <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                      <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">{f.label}</label>
                      <input className={inputCls} value={dst[f.key]} onChange={(e) => edit(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">ขนส่ง (รหัส iShip)</label>
                  <input className={inputCls} value={courier} onChange={(e) => { setCourier(e.target.value); setPrice(null); }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 block mb-0.5">พัสดุ</label>
                  <p className="text-xs text-zinc-600 py-1.5">
                    {prep.parcel.weightKg} กก. · {prep.parcel.widthCm}×{prep.parcel.lengthCm}×{prep.parcel.heightCm} ซม.
                  </p>
                </div>
              </div>

              {price && (
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2.5">
                  <p className="text-xs text-zinc-500">ค่าส่ง (ประมาณจาก iShip)</p>
                  <p className="text-lg font-bold text-zinc-900">฿{price.total.toLocaleString()}</p>
                  {price.remote > 0 && <p className="text-[10px] text-amber-700">รวมค่าพื้นที่ห่างไกล ฿{price.remote}</p>}
                </div>
              )}
            </>
          )}

          {err && (
            <div className={`rounded-xl px-3 py-2.5 border ${err.unsure ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-100"}`}>
              <p className={`text-xs font-semibold ${err.unsure ? "text-amber-800" : "text-red-700"}`}>
                {err.unsure ? "⚠ ไม่แน่ใจว่าสร้างแล้วหรือยัง — ห้ามกดซ้ำ" : "ไม่สำเร็จ"}
              </p>
              <p className={`text-[11px] mt-0.5 ${err.unsure ? "text-amber-800" : "text-red-600"}`}>{err.text}</p>
              {err.problems?.map((p) => <p key={p} className="text-[11px] text-red-600">• {p}</p>)}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy === "create"} className="text-xs text-zinc-500 border border-zinc-200 rounded-xl px-4 py-2">ปิด</button>
          {prep && !blocked && (
            <>
              <button onClick={doPrice} disabled={busy !== null}
                className="text-xs font-semibold border border-zinc-300 rounded-xl px-4 py-2 hover:bg-zinc-50 disabled:opacity-40">
                {busy === "price" ? "กำลังเช็ค..." : "เช็คราคา"}
              </button>
              <button onClick={doCreate} disabled={busy !== null || !price}
                title={price ? "" : "เช็คราคาก่อน"}
                className={`text-xs font-semibold text-white rounded-xl px-5 py-2 disabled:opacity-40 ${real ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-700"}`}>
                {busy === "create" ? "กำลังสร้าง..." : real ? "สร้างพัสดุจริง" : "สร้างพัสดุทดสอบ"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
