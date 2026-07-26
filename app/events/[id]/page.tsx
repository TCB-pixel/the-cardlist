"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

type EventType = "meetup" | "tournament" | "sale";

type Event = {
  id: string;
  title: string;
  location: string;
  date: string;
  date_end: string | null;
  time: string;
  tcg: string;
  format: string | null;
  max_slots: number;
  booked_slots: number;
  description: string | null;
  event_type: EventType;
  image_url: string | null;
  trading_tables_enabled: boolean;
};

const TCG_COLOR: Record<string, string> = {
  "Pokemon": "#EF9F27",
  "One Piece": "#E24B4A",
  "MTG": "#7F77DD",
  "Dragon Ball": "#1D9E75",
  "Mixed": "#6366f1",
  "Other": "#888",
};

function formatDate(date: string, dateEnd: string | null) {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleDateString("th-TH", { month: "long" });
  const year = d.getFullYear();
  if (dateEnd) {
    const de = new Date(dateEnd);
    return `${day}–${de.getDate()} ${month} ${year}`;
  }
  return `${day} ${month} ${year}`;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [qrCode, setQrCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ev, error }, { data: { session } }] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase.auth.getSession(),
    ]);
    if (error || !ev) {
      setNotFound(true);
    } else {
      setEvent(ev as Event);
    }
    setLoggedIn(!!session);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { if (eventId) load(); }, [eventId, load]);

  // เช็คว่าลงทะเบียนไปแล้วหรือยัง (ถ้า login)
  useEffect(() => {
    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !eventId) return;
      const { data } = await supabase
        .from("general_registrations")
        .select("id, qr_code")
        .eq("user_id", session.user.id)
        .eq("event_id", eventId)
        .maybeSingle();
      if (data) {
        setAlreadyRegistered(true);
        setQrCode(data.qr_code);
      }
    }
    checkExisting();
  }, [eventId]);

  async function handleRegister() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setRegistering(true);
    setRegisterError("");
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลงทะเบียนไม่สำเร็จ");
      setQrCode(data.qrCode);
      if (data.alreadyRegistered) setAlreadyRegistered(true);
      else setRegistered(true);
    } catch (e: any) {
      setRegisterError(e?.message ?? "ลงทะเบียนไม่สำเร็จ");
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20">
        <TopBar title="อีเวนต์" showBack />
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20">
        <TopBar title="อีเวนต์" showBack />
        <div className="text-center py-24 px-6">
          <p className="text-sm text-zinc-400 mb-4">ไม่พบอีเวนต์นี้</p>
          <Link href="/events" className="btn-primary inline-block px-6 py-2.5">กลับไปหน้าอีเวนต์</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const isTournament = event.event_type === "tournament";
  const done = registered || alreadyRegistered;

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <TopBar title="รายละเอียดอีเวนต์" showBack />

      {/* Banner */}
      {event.image_url && (
        <div className="relative w-full aspect-[16/9]">
          <Image src={event.image_url} alt={event.title} fill className="object-cover" sizes="100vw" priority />
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl border border-zinc-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TCG_COLOR[event.tcg] ?? "#888" }} />
            <span className="text-[9px] tracking-wider text-zinc-400 font-semibold">
              {event.tcg}{event.format ? ` · ${event.format}` : ""}
            </span>
          </div>
          <h1 className="text-lg font-bold text-zinc-900 leading-snug mb-3">{event.title}</h1>

          <div className="space-y-1.5 mb-4">
            <p className="text-xs text-zinc-500">📅 {formatDate(event.date, event.date_end)}</p>
            <p className="text-xs text-zinc-500">🕐 {event.time?.slice(0, 5)} น.</p>
            <p className="text-xs text-zinc-500">📍 {event.location}</p>
          </div>

          {event.description && (
            <p className="text-[13px] text-zinc-600 leading-relaxed whitespace-pre-line mb-4">{event.description}</p>
          )}

          <div className="bg-green-50 rounded-xl px-3 py-2.5 text-center mb-2">
            <p className="text-xs font-bold text-green-600">เข้างานฟรี ไม่มีค่าใช้จ่าย</p>
          </div>

          {event.trading_tables_enabled && (
            <Link href="/events"
              className="block w-full text-center text-xs font-semibold py-2.5 rounded-xl border border-zinc-200 text-zinc-700 active:bg-zinc-50 transition-colors">
              🃏 จองโต๊ะเทรดในงานนี้ — ไปที่แท็บ &quot;จองโต๊ะเทรด&quot;
            </Link>
          )}
        </div>

        {/* ── ลงทะเบียนเข้างาน (เฉพาะงาน meet up / general — tournament ใช้ระบบที่นั่งแยก) ── */}
        {!isTournament && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-1">ลงทะเบียนเข้าร่วมงาน</h2>
            <p className="text-[11px] text-zinc-400 mb-4">รับ QR Code สำหรับสแกนเข้างานและใช้สิทธิ์หน้างาน</p>

            {done ? (
              <div className="bg-zinc-50 rounded-2xl p-4 text-center border border-zinc-100">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-sm font-semibold text-zinc-900">
                  {alreadyRegistered && !registered ? "คุณลงทะเบียนงานนี้ไว้แล้ว" : "ลงทะเบียนสำเร็จ!"}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 font-mono">{qrCode}</p>
                <Link href="/profile" className="mt-4 inline-block text-xs font-semibold text-zinc-900 border border-zinc-200 rounded-xl px-5 py-2.5 active:bg-zinc-50">
                  ดู QR Code ที่โปรไฟล์ →
                </Link>
              </div>
            ) : (
              <>
                {registerError && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
                    <p className="text-[11px] text-red-600">{registerError}</p>
                  </div>
                )}
                {!loggedIn && (
                  <p className="text-[11px] text-amber-600 mb-3">
                    กรุณา <Link href="/login" className="font-semibold underline">เข้าสู่ระบบ</Link> ก่อนลงทะเบียน
                  </p>
                )}
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="w-full py-3 text-sm font-semibold rounded-xl bg-zinc-900 text-white disabled:opacity-50"
                >
                  {registering ? "กำลังลงทะเบียน..." : "ลงทะเบียนเข้าร่วมงาน"}
                </button>
              </>
            )}
          </div>
        )}

        {isTournament && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 text-center">
            <p className="text-xs text-zinc-500">งานนี้เป็นทัวร์นาเมนต์ กรุณาติดต่อสตาฟหน้าร้านเพื่อลงทะเบียนที่นั่ง</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
