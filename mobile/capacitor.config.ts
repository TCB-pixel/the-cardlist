import type { CapacitorConfig } from "@capacitor/cli";

// แอปมือถือ The Cardlist — เปิดเว็บจริง thecardlistbkk.com ในแอป แล้วเติมของเนทีฟ (กล้องสแกน QR, แจ้งเตือน)
// แผน: AI SMART/company-brain/output/web/2026-10-17_mobile-app-plan.md
// appId ใช้เป็น bundle ID (iOS) และ package name (Android) — เปลี่ยนไม่ได้หลังอัปโหลดขึ้นสโตร์ครั้งแรก
const config: CapacitorConfig = {
  appId: "com.thecardlist.app",
  appName: "The Cardlist",
  webDir: "www",
  server: {
    url: "https://thecardlistbkk.com",
    // โดเมนที่เปิดในแอปได้ (นอกนี้เด้งไปเบราว์เซอร์ของเครื่อง)
    allowNavigation: [
      "thecardlistbkk.com",
      "*.thecardlistbkk.com",
      "access.line.me",
      "*.line.me",
      "*.supabase.co",
      "*.stripe.com",
    ],
    // หน้าในเครื่องที่แสดงเมื่อโหลดเว็บไม่ได้ (ไม่มีเน็ต)
    errorPath: "error.html",
  },
  // ให้เว็บรู้ว่าเปิดจากแอป (ใช้ซ่อน/แสดงบางอย่างเฉพาะในแอป)
  appendUserAgent: "TheCardlistApp/1",
  backgroundColor: "#ffffff",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
  },
};

export default config;
