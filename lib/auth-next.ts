// ช่วยเรื่องเข้าสู่ระบบ: จำหน้าที่ลูกค้ากำลังทำอยู่แล้วพากลับหลังล็อกอิน + ข้อความผิดพลาดภาษาไทย

const BLOCKED = ["/login", "/register", "/reset-password", "/auth", "/api"];

// รับเฉพาะเส้นทางภายในเว็บเรา (กันลิงก์ที่พาไปเว็บอื่นหลังล็อกอิน)
export function safeNext(v: string | null | undefined): string | null {
  if (!v) return null;
  let s = v.trim();
  try { s = decodeURIComponent(s); } catch { return null; }
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || s.length > 300) return null;
  if (BLOCKED.some((b) => s === b || s.startsWith(b + "/") || s.startsWith(b + "?"))) return null;
  return s;
}

export function loginHref(next?: string | null): string {
  const n = safeNext(next ?? "");
  return n ? `/login?next=${encodeURIComponent(n)}` : "/login";
}

export function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;
}

// ไปหน้าเข้าสู่ระบบ แล้วกลับมาหน้าเดิมหลังล็อกอิน
export function goLogin() {
  window.location.href = loginHref(currentPath());
}

export const LINE_ERRORS: Record<string, string> = {
  line_cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE ลองใหม่อีกครั้งได้เลย",
  line_token_failed: "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่ หรือใช้อีเมลแทน",
  line_profile_failed: "ดึงข้อมูลจาก LINE ไม่สำเร็จ กรุณาลองใหม่",
  line_profile_update_failed: "บันทึกข้อมูลบัญชี LINE ไม่สำเร็จ กรุณาลองใหม่",
  line_profile_upsert_failed: "สร้างบัญชีจาก LINE ไม่สำเร็จ กรุณาลองใหม่",
  signup_failed: "สร้างบัญชีจาก LINE ไม่สำเร็จ กรุณาลองใหม่ หรือสมัครด้วยอีเมลแทน",
  signin_failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่",
  unknown: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
};

// แปลงข้อความผิดพลาดของระบบสมาชิก (ภาษาอังกฤษ) เป็นภาษาไทยที่ลูกค้าเข้าใจ
export function thaiAuthError(msg: string | null | undefined): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("email not confirmed")) return "ยังไม่ได้ยืนยันอีเมล กรุณากดลิงก์ในอีเมลที่เราส่งให้ก่อน";
  if (m.includes("already registered") || m.includes("already been registered")) return "อีเมลนี้สมัครสมาชิกไว้แล้ว ลองเข้าสู่ระบบ หรือกด \"ลืมรหัสผ่าน\"";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (m.includes("password") && (m.includes("weak") || m.includes("least") || m.includes("short"))) return "รหัสผ่านสั้นหรือคาดเดาง่ายเกินไป ใช้อย่างน้อย 8 ตัวอักษร";
  if (m.includes("same password") || m.includes("different from the old")) return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (m.includes("network") || m.includes("fetch")) return "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่";
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}
