"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAdmin } from "@/lib/admin-context";

type Row = {
  sku: string;
  name: string;
  webStock: number | null;
  posStock: number | null;
  status: "match" | "diff" | "web_only" | "pos_only";
};
type Data = {
  stores: { id: string; name: string }[];
  storeId: string;
  summary: { match: number; diff: number; webOnly: number; posOnly: number; webNoSku: number; posNoSku: number };
  rows: Row[];
};

const STATUS: Record<Row["status"], { label: string; cls: string }> = {
  diff:     { label: "ไม่ตรงกัน",       cls: "bg-amber-50 text-amber-700" },
  web_only: { label: "มีแต่บนเว็บ",     cls: "bg-blue-50 text-blue-700" },
  pos_only: { label: "มีแต่ใน Loyverse", cls: "bg-purple-50 text-purple-700" },
  match:    { label: "ตรงกัน",          cls: "bg-green-50 text-green-700" },
};

export default function StockSyncPage() {
  const { can: canDo } = useAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [storeId, setStoreId] = useState("");
  const [filter, setFilter] = useState<"all" | Row["status"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/loyverse?storeId=${encodeURIComponent(storeId)}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  if (!canDo("products:view")) {
    return <div className="p-6"><p className="text-xs text-zinc-400">ไม่มีสิทธิ์เข้าถึงหน้านี้</p></div>;
  }

  const rows = (data?.rows ?? []).filter((r) => filter === "all" || r.status === filter);

  function exportCsv() {
    if (!data) return;
    const head = ["SKU", "ชื่อสินค้า", "สต็อกเว็บ", "สต็อก Loyverse", "สถานะ"];
    const body = data.rows.map((r) => [r.sku, r.name, r.webStock ?? "", r.posStock ?? "", STATUS[r.status].label]);
    const csv = "﻿" + [head, ...body]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `stock-compare-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900">เทียบสต็อกกับ Loyverse</h1>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            จับคู่ด้วย SKU · หน้านี้<strong>อ่านอย่างเดียว</strong> ไม่แก้สต็อกทั้งสองฝั่ง
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(data?.stores.length ?? 0) > 1 && (
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 outline-none">
              <option value="">ทุกสาขา (รวมกัน)</option>
              {data?.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={load} disabled={loading}
            className="border border-zinc-200 text-zinc-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-zinc-50 disabled:opacity-40">
            {loading ? "กำลังโหลด..." : "↻ ดึงใหม่"}
          </button>
          <button onClick={exportCsv} disabled={!data}
            className="border border-zinc-200 text-zinc-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-zinc-50 disabled:opacity-40">
            ⬇ CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
          <p className="text-[11px] text-red-600 font-semibold mb-1">เชื่อมต่อ Loyverse ไม่สำเร็จ</p>
          <p className="text-[11px] text-red-600">{error}</p>
          {error.includes("LOYVERSE_ACCESS_TOKEN") && (
            <p className="text-[10px] text-red-500 mt-2">
              ใส่ token ที่ Vercel → Settings → Environment Variables ชื่อ <code>LOYVERSE_ACCESS_TOKEN</code> แล้ว redeploy
            </p>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {([
              ["ตรงกัน", data.summary.match, "all" as const, "match" as const],
              ["ไม่ตรงกัน", data.summary.diff, "diff" as const, "diff" as const],
              ["มีแต่บนเว็บ", data.summary.webOnly, "web_only" as const, "web_only" as const],
              ["มีแต่ใน Loyverse", data.summary.posOnly, "pos_only" as const, "pos_only" as const],
            ]).map(([label, n, key]) => (
              <button key={String(label)} onClick={() => setFilter(filter === key ? "all" : key as any)}
                className={`bg-white border rounded-2xl px-4 py-3 text-left transition-colors ${
                  filter === key ? "border-zinc-900" : "border-zinc-100 hover:border-zinc-200"}`}>
                <p className="text-[10px] text-zinc-400 tracking-widest">{label}</p>
                <p className="text-xl font-bold text-zinc-900 mt-1">{n as number}</p>
              </button>
            ))}
          </div>

          {(data.summary.webNoSku > 0 || data.summary.posNoSku > 0) && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-4">
              ⚠️ ไม่ได้นำมาเทียบเพราะไม่มี SKU — บนเว็บ {data.summary.webNoSku} รายการ · ใน Loyverse {data.summary.posNoSku} รายการ
            </p>
          )}

          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {["SKU", "ชื่อสินค้า", "เว็บ", "Loyverse", "สถานะ"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold text-zinc-400 tracking-widest uppercase px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">กำลังดึงข้อมูลจาก Loyverse...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-400">ไม่มีรายการในกลุ่มนี้</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.sku + r.status} className="border-b border-zinc-50 hover:bg-zinc-50 last:border-none">
                    <td className="px-5 py-3 text-[11px] font-mono text-zinc-600">{r.sku}</td>
                    <td className="px-5 py-3 text-xs text-zinc-900">{r.name}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-zinc-900">{r.webStock ?? "—"}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-zinc-900">{r.posStock ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${STATUS[r.status].cls}`}>
                        {STATUS[r.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
