"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-fetch";
import Scanner from "@/components/passport/Scanner";
import PassportQR from "@/components/passport/PassportQR";

type Lookup = {
  passport: { id: string; code: string; kind: string; isTest: boolean; activatedAt: string | null; soldAt: string | null; nickname: string | null; memberCode: string | null };
  stamps: { name: string; track: string; at: string }[];
  wallet: { id: string; kind: string; status: string; tier: string; name: string; color: string; needsPayment: boolean; redeemedAt: string | null; redeemedBy: string | null }[];
  warn: string[];
};

function t(iso: string) { return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

// หน้าพนักงานบูธ: ขาย Passport + สแกนแลกของ
export default function PassportBoothPage() {
  const [tab, setTab] = useState<"sell" | "redeem">("sell");
  const [scan, setScan] = useState<null | "card" | "redeem">(null);
  const [test, setTest] = useState(false);
  const [sold, setSold] = useState<{ code: string; claimUrl: string; isTest: boolean } | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lastToken, setLastToken] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function sell(code?: string) {
    setErr(""); setBusy(true);
    const r = await adminFetch("/api/admin/passport", { method: "POST", body: JSON.stringify({ action: "sell", code, test }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error ?? "บันทึกการขายไม่สำเร็จ"); return; }
    setSold(j);
  }

  async function find(token: string) {
    setErr(""); setLookup(null); setBusy(true); setLastToken(token);
    const r = await adminFetch(`/api/admin/passport/redeem?t=${encodeURIComponent(token)}`);
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error ?? "ไม่พบข้อมูล"); return; }
    setLookup(j);
  }

  async function confirm(id: string) {
    const r = await adminFetch("/api/admin/passport/redeem", { method: "POST", body: JSON.stringify({ id }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "ยืนยันไม่สำเร็จ"); return false; }
    setLookup((l) => l && { ...l, wallet: l.wallet.map((w) => w.id === id ? { ...w, status: "redeemed", redeemedAt: new Date().toISOString() } : w) });
    return true;
  }

  return (
    <div className="mx-auto max-w-lg p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="text-lg font-semibold text-zinc-900">Passport · บูธ</h1><p className="text-xs text-zinc-500">ขายการ์ด {`/`} แลกของรางวัล</p></div>
        <Link href="/admin/passport" className="text-xs text-zinc-500 underline">ภาพรวม</Link>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["sell", "redeem"] as const).map((k) => (
          <button key={k} onClick={() => { setTab(k); setErr(""); setScan(null); }}
            className={`rounded-lg border py-2 text-sm ${tab === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600"}`}>
            {k === "sell" ? "ขาย Passport" : "แลกของ"}
          </button>
        ))}
      </div>
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {tab === "sell" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex justify-between text-sm"><span>CARDLIST PASSPORT</span><b>100 บาท</b></div>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-zinc-500">
              <li>รับเงินที่ Loyverse ตามปกติ</li>
              <li>มีการ์ดพิมพ์: กด &quot;สแกนการ์ด&quot; แล้วสแกน QR หลังการ์ด · ไม่มีการ์ด: กด &quot;ออก Passport ใหม่&quot;</li>
              <li>ให้ลูกค้าสแกน QR บนการ์ด (หรือบนจอนี้) ด้วยมือถือ</li>
            </ol>
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />ชุดทดสอบ (ไม่นับยอดจริง)</label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setScan("card")} className="rounded-lg border border-zinc-300 py-2.5 text-sm">สแกนการ์ด</button>
              <button disabled={busy} onClick={() => sell()} className="rounded-lg bg-zinc-900 py-2.5 text-sm text-white disabled:opacity-50">ออก Passport ใหม่</button>
            </div>
          </div>
          {scan === "card" && <Scanner dark={false} onClose={() => setScan(null)} onResult={(x) => { setScan(null); sell(x); }} />}
          {sold && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-sm font-semibold text-green-800">บันทึกการขายแล้ว · {sold.code}{sold.isTest ? " (TEST)" : ""}</p>
              <p className="mb-3 text-xs text-green-700">ให้ลูกค้าสแกน QR นี้ด้วยกล้องมือถือเพื่อเปิดใช้</p>
              <div className="flex justify-center"><PassportQR value={sold.claimUrl} size={200} /></div>
              <button onClick={() => setSold(null)} className="mt-3 text-xs text-green-800 underline">ลูกค้าสแกนแล้ว · ปิด</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!scan && <button onClick={() => { setScan("redeem"); setLookup(null); }} className="w-full rounded-lg bg-zinc-900 py-3 text-sm text-white">สแกน QR &quot;รางวัลของฉัน&quot; บนมือถือลูกค้า</button>}
          {scan === "redeem" && <Scanner dark={false} onClose={() => setScan(null)} onResult={(x) => { setScan(null); find(x); }} />}
          {busy && <p className="text-sm text-zinc-500">กำลังค้นหา…</p>}
          {lookup && (
            <>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                {lookup.passport.nickname && <p className="text-base font-semibold">{lookup.passport.nickname}<span className="ml-2 text-xs font-normal text-zinc-500">{lookup.passport.memberCode ?? ""}</span></p>}
                <p className="font-mono text-sm font-semibold">{lookup.passport.code}{lookup.passport.isTest ? " · TEST" : ""}</p>
                <p className="text-xs text-zinc-500">{lookup.passport.kind === "card" ? `การ์ด · เปิดใช้ ${lookup.passport.activatedAt ? t(lookup.passport.activatedAt) : "—"}` : "Learn To Play (ไม่ได้ซื้อการ์ด)"}</p>
                <div className="mt-2 divide-y divide-zinc-100 text-xs">
                  {lookup.stamps.map((s, i) => <div key={i} className="flex justify-between py-1"><span>{s.track === "learn" ? "[เรียน] " : ""}{s.name}</span><span className="text-zinc-500">{t(s.at)}</span></div>)}
                  {lookup.stamps.length === 0 && <p className="py-1 text-zinc-500">ยังไม่มีแสตมป์</p>}
                </div>
              </div>
              {lookup.warn.map((w, i) => <div key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{w}</div>)}
              {lookup.wallet.length === 0 && <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600">ยังไม่มีรางวัล</div>}
              {lookup.wallet.map((w) => (
                <div key={w.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: w.color + "22", color: w.color === "#e9d29a" ? "#854d0e" : w.color === "#a1a1aa" ? "#52525b" : w.color }}>{w.tier}</span>
                      <p className="mt-1 text-sm">{w.name}</p></div>
                    {w.status === "redeemed" && <span className="text-xs text-green-700">แลกแล้ว ✓</span>}
                  </div>
                  {w.needsPayment && w.status === "pending" && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">สิทธิ์ซื้อราคาป้าย — ให้ลูกค้าชำระที่ Loyverse ก่อนส่งของ</p>}
                  {w.status === "pending" ? <Swipe onDone={() => confirm(w.id)} /> : <p className="mt-1 text-[11px] text-zinc-500">{w.redeemedAt ? t(w.redeemedAt) : ""} {w.redeemedBy ?? ""}</p>}
                </div>
              ))}
              <button onClick={() => find(lastToken)} className="w-full text-xs text-zinc-500 underline">โหลดใหม่</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ปัดเพื่อยืนยัน — กันพนักงานเผลอแตะโดน
function Swipe({ onDone }: { onDone: () => Promise<boolean> }) {
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const x0 = useRef<number | null>(null);
  const max = () => (box.current?.offsetWidth ?? 300) - 52;
  return (
    <div ref={box} className="relative mt-3 h-[52px] select-none overflow-hidden rounded-full bg-zinc-900" style={{ touchAction: "none" }}>
      <div className="absolute inset-y-0 left-0 bg-green-600" style={{ width: done ? "100%" : x + 26 }} />
      <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-200">{done ? "แลกแล้ว" : "ปัดเพื่อยืนยันแลก"}</div>
      <div className="absolute top-1 flex h-11 w-11 cursor-grab items-center justify-center rounded-full bg-white text-lg"
        style={{ left: 4 + (done ? max() : x) }}
        onPointerDown={(e) => { if (done) return; x0.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (x0.current === null) return; setX(Math.max(0, Math.min(max(), e.clientX - x0.current))); }}
        onPointerUp={async () => {
          if (x0.current === null) return; x0.current = null;
          if (x >= max() * 0.9) { setDone(true); if (!(await onDone())) { setDone(false); setX(0); } } else setX(0);
        }}>{done ? "✓" : "›"}</div>
    </div>
  );
}
