"use client";
import { useEffect, useRef, useState } from "react";
import { canScanNatively, scanQrNative } from "@/lib/native";

// กล้องสแกน QR (html5-qrcode ตัวเดียวกับ /admin/scan) — อ่านได้ 1 ครั้งแล้วปิดกล้อง
// เปิดในแอปมือถือ → ใช้กล้องเนทีฟเต็มจอแทน (เร็วกว่า ไม่ต้องขออนุญาตกล้องในเว็บ)
export default function Scanner({ onResult, onClose, dark = true }: { onResult: (text: string) => void; onClose: () => void; dark?: boolean }) {
  const ref = useRef<any>(null);
  const [err, setErr] = useState("");
  const [native, setNative] = useState(false);
  const nativeStarted = useRef(false);
  const id = useRef(`qr-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (canScanNatively()) {
      setNative(true);
      if (nativeStarted.current) return;
      nativeStarted.current = true;
      scanQrNative("วาง QR ให้อยู่ในกรอบ").then((text) => (text ? onResult(text) : onClose()));
      return;
    }
    let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const s = new Html5Qrcode(id);
        ref.current = s;
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } }, async (text: string) => {
          if (stopped) return;
          stopped = true;
          try { await s.stop(); } catch {}
          ref.current = null;
          onResult(text.trim());
        }, undefined);
      } catch {
        setErr("เปิดกล้องไม่ได้ — อนุญาตการใช้กล้อง หรือใช้กล้องมือถือสแกนแทน");
      }
    })();
    return () => { stopped = true; ref.current?.stop?.().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (native) return null; // กล้องเนทีฟแสดงเต็มจอเอง

  return (
    <div className={`rounded-2xl p-3 ${dark ? "bg-zinc-900" : "bg-white border border-zinc-200"}`}>
      <div id={id} className="overflow-hidden rounded-xl bg-black" style={{ minHeight: 240 }} />
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <button onClick={onClose} className={`mt-3 w-full rounded-xl py-2.5 text-sm ${dark ? "border border-zinc-700 text-zinc-300" : "border border-zinc-200 text-zinc-700"}`}>ปิดกล้อง</button>
    </div>
  );
}
