import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminDb } from "@/lib/require-admin";

// ─────────────────────────────────────────────────────────────────────────────
// CARDLIST PASSPORT — ตัวตนผู้เล่น = สมาชิกเว็บที่ล็อกอินด้วย LINE (เจ้าของสั่ง 17 ต.ค. 2026)
// ต้องสมัคร Passport (ชื่อเล่น ช่วงอายุ ยินยอม PDPA) ก่อนเก็บแสตมป์
// ─────────────────────────────────────────────────────────────────────────────

export const CONSENT_VERSION = "passport-2026-10-17";

export const AGE_RANGES = [
  { v: "under10", th: "ต่ำกว่า 10 ปี" },
  { v: "10-14", th: "10–14 ปี" },
  { v: "15-19", th: "15–19 ปี" },
  { v: "20-29", th: "20–29 ปี" },
  { v: "30-39", th: "30–39 ปี" },
  { v: "40+", th: "40 ปีขึ้นไป" },
] as const;
export const MINOR_AGES = ["under10", "10-14", "15-19"];

export type MemberStatus = {
  userId: string;
  joined: boolean;
  nickname: string | null;
  lineName: string | null;
  marketing: boolean;
};

// ผู้ใช้ที่ล็อกอินอยู่ (อ่านคุกกี้ session ของ Supabase) — ไม่มี = null
export async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return store.getAll(); }, setAll() { /* route นี้ไม่ต่ออายุ session */ } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function latestConsent(userId: string, purpose: "passport" | "marketing") {
  const { data } = await adminDb.from("member_consents").select("granted")
    .eq("user_id", userId).eq("purpose", purpose).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return !!data?.granted;
}

export async function memberStatus(userId: string): Promise<MemberStatus> {
  const [{ data: m }, { data: prof }, consent, marketing] = await Promise.all([
    adminDb.from("passport_members").select("nickname").eq("user_id", userId).maybeSingle(),
    adminDb.from("profiles").select("display_name, line_display_name").eq("id", userId).maybeSingle(),
    latestConsent(userId, "passport"),
    latestConsent(userId, "marketing"),
  ]);
  return {
    userId,
    joined: !!m && consent,
    nickname: m?.nickname ?? null,
    lineName: prof?.line_display_name ?? prof?.display_name ?? null,
    marketing,
  };
}
