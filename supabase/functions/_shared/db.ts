import { createClient } from "npm:@supabase/supabase-js@2";

// service role — ผ่าน RLS ได้ ใช้เฉพาะใน Edge Function (Supabase ใส่ env 2 ตัวนี้ให้อัตโนมัติ)
export const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export function ownerId(): string | null {
  return Deno.env.get("OWNER_LINE_USER_ID") ?? null;
}

export const WAIT_MESSAGE = "รอแอดมินตรวจสอบสักครู่นะครับ 🙏";
export const WAIT_MESSAGE_EN = "Thank you! Our admin will check and get back to you shortly 🙏";

// ข้อความไม่มีตัวอักษรไทยเลย = ลูกค้าต่างชาติ → ข้อความระบบเป็นภาษาอังกฤษ
export function waitMessageFor(text: string): string {
  return /[฀-๿]/.test(text) ? WAIT_MESSAGE : WAIT_MESSAGE_EN;
}
