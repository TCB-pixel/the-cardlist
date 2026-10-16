// ข้อความผิดพลาดของระบบสมาชิกตามภาษาที่ลูกค้าเลือก (ไทยใช้ของ lib/auth-next ตามเดิม)
import type { Lang } from "@/lib/i18n";
import { LINE_ERRORS, thaiAuthError } from "@/lib/auth-next";

const LINE_ERRORS_EN: Record<string, string> = {
  line_cancelled: "LINE login was cancelled. Feel free to try again.",
  line_state: "LINE login timed out or was invalid. Please tap Continue with LINE again.",
  line_token_failed: "Couldn't connect to LINE. Please try again, or use email instead.",
  line_profile_failed: "Couldn't get your info from LINE. Please try again.",
  line_profile_update_failed: "Couldn't save your LINE account info. Please try again.",
  line_profile_upsert_failed: "Couldn't create an account from LINE. Please try again.",
  signup_failed: "Couldn't create an account from LINE. Please try again, or sign up with email.",
  signin_failed: "LINE login failed. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

export function lineError(code: string, lang: Lang): string {
  if (lang === "en") return LINE_ERRORS_EN[code] ?? LINE_ERRORS_EN.unknown;
  return LINE_ERRORS[code] ?? LINE_ERRORS.unknown;
}

// เงื่อนไขเดียวกับ thaiAuthError ใน lib/auth-next
function englishAuthError(msg: string | null | undefined): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Your email isn't confirmed yet. Please tap the link in the email we sent you.";
  if (m.includes("already registered") || m.includes("already been registered")) return "This email is already registered. Try logging in, or tap \"Forgot password?\"";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("password") && (m.includes("weak") || m.includes("least") || m.includes("short"))) return "Password is too short or too easy to guess. Use at least 8 characters.";
  if (m.includes("same password") || m.includes("different from the old")) return "Your new password must be different from the old one.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Invalid email format.";
  if (m.includes("network") || m.includes("fetch")) return "Can't connect. Check your internet and try again.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "This link has expired or was already used. Please request a new one.";
  return "Something went wrong. Please try again.";
}

export function authError(msg: string | null | undefined, lang: Lang): string {
  return lang === "en" ? englishAuthError(msg) : thaiAuthError(msg);
}
