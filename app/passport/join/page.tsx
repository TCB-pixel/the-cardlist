"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Info = {
  auth: "login" | "join" | "ok";
  member?: { nickname: string | null; lineName: string | null };
  games?: string[];
  ages?: { v: string; th: string }[];
};
const MINOR = ["under10", "10-14", "15-19"];

function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/passport";
  return n.startsWith("/passport") ? n : "/passport";
}

// สมัคร CARDLIST PASSPORT: ล็อกอิน LINE → ชื่อเล่น ช่วงอายุ เกมที่เล่น → ยินยอม PDPA (แยกยินยอมรับข่าวสาร)
export default function PassportJoin() {
  const [info, setInfo] = useState<Info | null>(null);
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [games, setGames] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/passport/join", { cache: "no-store" }).then(async (r) => {
      const j: Info = await r.json().catch(() => ({ auth: "login" }));
      if (j.auth === "ok") { window.location.replace(nextPath()); return; }
      setInfo(j);
      setNickname(j.member?.nickname ?? j.member?.lineName ?? "");
    });
  }, []);

  const minor = MINOR.includes(age);
  const under10 = age === "under10";

  async function submit() {
    setErr("");
    if (!nickname.trim()) return setErr("กรอกชื่อเล่น");
    if (!age) return setErr("เลือกช่วงอายุ");
    if (!consent) return setErr("ต้องยินยอมให้ใช้ข้อมูลเพื่อระบบ Passport ก่อน");
    if (minor && !guardian) return setErr(under10 ? "ผู้ปกครองต้องเป็นผู้สมัครแทน" : "ต้องได้รับความยินยอมจากผู้ปกครอง");
    setBusy(true);
    const r = await fetch("/api/passport/join", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, age_range: age, games, consent, guardian, marketing: !minor && marketing }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "สมัครไม่สำเร็จ ลองอีกครั้ง");
    window.location.replace(nextPath());
  }

  if (!info) return <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-500">กำลังโหลด…</div>;

  if (info.auth === "login") {
    const back = window.location.pathname + window.location.search;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
        <img src="/images/passport/c-mark.png" alt="The Cardlist" className="mx-auto h-14 w-14 object-contain" />
        <p className="mt-4 font-cardlist text-xs tracking-[0.12em] text-white">THE CARDLIST</p>
        <p className="font-cardlist text-4xl tracking-[0.06em] text-[var(--hi)]">PASSPORT</p>
        <p className="mb-8 mt-3 text-sm text-zinc-400">สมัครสมาชิก The Cardlist ด้วย LINE ก่อนเริ่มสะสมแสตมป์ · ใช้เวลาไม่ถึง 1 นาที · เปลี่ยนมือถือก็ไม่หาย</p>
        <a href={`/api/auth/line?next=${encodeURIComponent(back)}`} className="block rounded-xl bg-[#06C755] py-3.5 text-base font-semibold text-white">เข้าสู่ระบบด้วย LINE</a>
        <a href={`/login?next=${encodeURIComponent(back)}`} className="mt-3 block text-xs text-zinc-400 underline">ไม่มี LINE? เข้าสู่ระบบด้วยอีเมล</a>
        <p className="mt-4 text-[11px] text-zinc-500">เมื่อเข้าสู่ระบบ เราจะได้รับ LINE user ID ชื่อที่แสดง และรูปโปรไฟล์ · อ่าน <Link href="/privacy#passport" className="underline">ประกาศความเป็นส่วนตัว</Link></p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-8">
      <p className="font-cardlist text-xs tracking-[0.12em] text-[var(--gold)]">CARDLIST PASSPORT</p>
      <h1 className="text-xl font-semibold text-white">สมัคร Passport</h1>
      <p className="mb-5 text-xs text-zinc-400">เข้าสู่ระบบด้วย LINE แล้ว{info.member?.lineName ? ` (${info.member.lineName})` : ""} · กรอกอีก 2 ข้อ</p>

      <label className="mb-1 block text-sm text-zinc-200">ชื่อเล่น <span className="text-[var(--hi)]">*</span></label>
      <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} placeholder="เช่น บอส"
        className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white outline-none focus:border-[var(--gold)]" />

      <label className="mb-1 block text-sm text-zinc-200">ช่วงอายุ <span className="text-[var(--hi)]">*</span></label>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(info.ages ?? []).map((a) => (
          <button key={a.v} onClick={() => setAge(a.v)} className={`rounded-lg border py-2 text-xs ${age === a.v ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--night)]" : "border-zinc-700 text-zinc-300"}`}>{a.th}</button>
        ))}
      </div>

      <label className="mb-1 block text-sm text-zinc-200">เกมที่เล่น <span className="text-xs text-zinc-500">(ไม่บังคับ)</span></label>
      <div className="mb-5 flex flex-wrap gap-2">
        {(info.games ?? []).map((g) => {
          const on = games.includes(g);
          return <button key={g} onClick={() => setGames(on ? games.filter((x) => x !== g) : [...games, g])}
            className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[var(--gold)] text-[var(--hi)]" : "border-zinc-700 text-zinc-400"}`}>{g}</button>;
        })}
      </div>

      <div className="space-y-3 rounded-xl bg-zinc-900 p-4 text-sm">
        <label className="flex gap-3">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#a88c4a]" />
          <span className="text-zinc-200">ฉันยินยอมให้ The Cardlist (CL Studio) ใช้ชื่อเล่น ช่วงอายุ เกมที่เล่น ข้อมูล LINE และประวัติการสแกน เพื่อให้บริการ CARDLIST PASSPORT แจกรางวัล และสรุปสถิติงานอีเวนต์ <span className="text-[var(--hi)]">(จำเป็น)</span></span>
        </label>
        {minor && (
          <label className="flex gap-3">
            <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#a88c4a]" />
            <span className="text-amber-200">{under10 ? "ฉันเป็นผู้ปกครองและสมัครแทนเด็ก" : "ผู้ปกครองรับทราบและยินยอมให้สมัคร"} <span className="text-[var(--hi)]">(จำเป็นสำหรับอายุต่ำกว่า 20 ปี)</span></span>
          </label>
        )}
        {!minor && (
          <label className="flex gap-3">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#a88c4a]" />
            <span className="text-zinc-300">รับข่าวสาร โปรโมชัน และอีเวนต์ของ The Cardlist ทาง LINE <span className="text-zinc-500">(ไม่บังคับ · ยกเลิกได้ทุกเมื่อ)</span></span>
          </label>
        )}
        <p className="text-[11px] text-zinc-500">ถอนความยินยอมหรือขอลบข้อมูลได้ที่หน้า Passport หรือ <Link href="/account/delete" className="underline">ขอลบบัญชี</Link> · รายละเอียดใน <Link href="/privacy#passport" className="underline">ประกาศความเป็นส่วนตัว</Link></p>
      </div>

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <button disabled={busy} onClick={submit} className="mt-5 w-full rounded-xl bg-[var(--gold)] py-3.5 text-base font-semibold text-[var(--night)] disabled:opacity-50">{busy ? "กำลังบันทึก…" : "สมัครและเริ่มสะสมแสตมป์"}</button>
    </main>
  );
}
