import { APP_SCHEME } from "@/lib/app-login";

// หน้าสุดท้ายของล็อกอิน LINE ที่เริ่มจากแอป (เปิดในเบราว์เซอร์ของเครื่อง) — เด้งกลับเข้าแอปพร้อมรหัสใช้ครั้งเดียว
// มีปุ่มสำรองเผื่อเบราว์เซอร์ไม่ยอมเปิดแอปเอง
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9_-]{40,4000}$/.test(code)) {
    return Response.redirect(new URL("/login?error=signin_failed", req.url), 302);
  }
  const appUrl = `${APP_SCHEME}://auth?code=${code}`;
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>The Cardlist</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;background:#fff;color:#18181b;padding:24px;box-sizing:border-box;text-align:center}
a{display:inline-block;border-radius:9999px;background:#18181b;color:#fff;text-decoration:none;padding:12px 28px;font-size:15px}p{margin:0;font-size:14px;color:#52525b}</style>
</head><body>
<p>เข้าสู่ระบบสำเร็จ กำลังกลับไปที่แอป…</p>
<a href="${appUrl}">กลับไปที่แอป The Cardlist</a>
<script>location.href=${JSON.stringify(appUrl)};</script>
</body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
