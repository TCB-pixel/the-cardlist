"use client";
import { useEffect, useState } from "react";

// QR แบบรูป (ใช้ไลบรารี qrcode ที่มีอยู่แล้ว) — พื้นขาวขอบกว้างพอให้กล้องอ่านง่าย
export default function PassportQR({ value, size = 180, className = "" }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M", color: { dark: "#141414", light: "#ffffff" } })
    ).then((url) => { if (alive) setSrc(url); }).catch(() => {});
    return () => { alive = false; };
  }, [value, size]);
  return (
    <div className={`bg-white rounded-xl p-2 ${className}`} style={{ width: size + 16, height: size + 16 }}>
      {src ? <img src={src} alt="QR" width={size} height={size} /> : <div style={{ width: size, height: size }} className="bg-zinc-100 rounded" />}
    </div>
  );
}
