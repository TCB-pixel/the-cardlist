"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import { loginHref } from "@/lib/auth-next";

// หน้าขอลบบัญชี — Google Play กำหนดให้มีทั้งในแอปและเป็นลิงก์เว็บที่เปิดได้โดยไม่ต้องล็อกอิน
const CONTACT_EMAIL = "thecardlistbkk@gmail.com";

export default function DeleteAccountPage() {
  const { L } = useLang();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? (session ? "" : null));
      setChecked(true);
    });
  }, []);

  async function submit() {
    setState("sending");
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ reason }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  const deleted = [
    L("ข้อมูลโปรไฟล์: ชื่อ วันเกิด เบอร์โทร อีเมล รูปโปรไฟล์ และการเชื่อมต่อ LINE", "Profile: name, date of birth, phone, email, profile picture and LINE link"),
    L("ที่อยู่จัดส่งที่บันทึกไว้", "Saved shipping addresses"),
    L("คอลเลกชัน เด็ค แต้ม และสิทธิประโยชน์สมาชิก", "Collections, decks, points and member benefits"),
  ];
  const kept = L(
    "ประวัติคำสั่งซื้อ การชำระเงิน และการจองบูธที่ชำระแล้ว จะถูกเก็บไว้ตามระยะเวลาที่กฎหมายบัญชีและภาษีกำหนด โดยไม่เชื่อมกับบัญชีของคุณอีกต่อไป",
    "Paid orders, payments and booth bookings are kept for the period required by accounting and tax law, no longer linked to your account."
  );

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar title={L("ลบบัญชี", "Delete account")} showBack />
      <main className="px-5 py-5 max-w-xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{L("ลบบัญชี The Cardlist", "Delete your The Cardlist account")}</h1>
          <p className="text-sm text-zinc-700 leading-relaxed mt-2">
            {L(
              "เมื่อส่งคำขอ ทีมงานจะยืนยันและลบบัญชีของคุณภายใน 30 วัน และแจ้งให้ทราบเมื่อเสร็จ การลบไม่สามารถย้อนกลับได้",
              "Once you send a request, our team will verify it and delete your account within 30 days, then let you know. Deletion can't be undone."
            )}
          </p>
        </div>

        <section className="card p-4">
          <h2 className="text-sm font-semibold text-zinc-900">{L("ข้อมูลที่จะถูกลบ", "What gets deleted")}</h2>
          <ul className="mt-2 space-y-1.5 list-disc pl-5">
            {deleted.map((d) => <li key={d} className="text-sm text-zinc-700">{d}</li>)}
          </ul>
          <h2 className="text-sm font-semibold text-zinc-900 mt-4">{L("ข้อมูลที่ต้องเก็บไว้", "What we have to keep")}</h2>
          <p className="text-sm text-zinc-700 leading-relaxed mt-1.5">{kept}</p>
        </section>

        {!checked ? (
          <div className="card p-4 h-28 bg-zinc-100 animate-pulse" />
        ) : state === "sent" ? (
          <div className="card p-4 bg-green-50 border-green-100" role="status">
            <p className="text-sm font-semibold text-green-700">{L("ส่งคำขอแล้ว", "Request sent")}</p>
            <p className="text-sm text-green-700 mt-1">
              {L("ทีมงานจะติดต่อกลับและดำเนินการภายใน 30 วัน", "Our team will follow up and complete it within 30 days.")}
            </p>
          </div>
        ) : email === null ? (
          <section className="card p-4 space-y-3">
            <p className="text-sm text-zinc-700">
              {L("เข้าสู่ระบบเพื่อส่งคำขอลบบัญชีของคุณ", "Log in to request deletion of your account.")}
            </p>
            <Link href={loginHref("/account/delete")} className="btn-primary block text-center">
              {L("เข้าสู่ระบบ", "Log in")}
            </Link>
            <p className="text-xs text-zinc-500">
              {L("เข้าสู่ระบบไม่ได้? อีเมลมาที่", "Can't log in? Email")}{" "}
              <a href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20account`} className="underline">{CONTACT_EMAIL}</a>{" "}
              {L("พร้อมอีเมลหรือเบอร์โทรที่ใช้สมัคร", "with the email or phone number you signed up with.")}
            </p>
          </section>
        ) : (
          <section className="card p-4 space-y-3">
            {email && (
              <p className="text-xs text-zinc-500">
                {L("บัญชี", "Account")}: <span className="text-zinc-900 font-medium">{email}</span>
              </p>
            )}
            <label className="block">
              <span className="text-xs text-zinc-700">{L("เหตุผล (ไม่บังคับ)", "Reason (optional)")}</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
                className="input mt-1" />
            </label>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
              <span>{L("ฉันเข้าใจว่าแต้มและสิทธิประโยชน์ทั้งหมดจะหายไป และย้อนกลับไม่ได้", "I understand my points and benefits will be lost and this can't be undone.")}</span>
            </label>
            {state === "error" && (
              <p className="text-xs text-red-600">
                {L("ส่งคำขอไม่สำเร็จ ลองใหม่ หรืออีเมลมาที่ ", "Couldn't send the request. Try again or email ")}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
              </p>
            )}
            <button onClick={submit} disabled={!confirm || state === "sending"}
              className="w-full bg-red-600 text-white text-xs font-semibold px-4 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:opacity-80">
              {state === "sending" ? L("กำลังส่ง…", "Sending…") : L("ส่งคำขอลบบัญชี", "Request account deletion")}
            </button>
          </section>
        )}

        <p className="text-xs text-zinc-500 text-center">
          <Link href="/privacy" className="underline">{L("นโยบายความเป็นส่วนตัว", "Privacy Policy")}</Link>
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
