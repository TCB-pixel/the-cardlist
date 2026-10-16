import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { SPLASH_SCRIPT } from "@/lib/splash";

const SITE_DESCRIPTION = "แพลตฟอร์มสำหรับคนเล่นการ์ดเกมในไทย — ซื้อการ์ดและอุปกรณ์ ติดตามอีเวนต์ และจองโต๊ะร้านค้าในงาน The Cardlist";

export const metadata: Metadata = {
  metadataBase: new URL("https://thecardlistbkk.com"),
  title: { default: "The Cardlist — ชุมชนการ์ดเกมไทย", template: "%s | The Cardlist" },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "The Cardlist",
    locale: "th_TH",
    title: "The Cardlist — ชุมชนการ์ดเกมไทย",
    description: SITE_DESCRIPTION,
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "The Cardlist" }],
  },
  twitter: { card: "summary", title: "The Cardlist — ชุมชนการ์ดเกมไทย", description: SITE_DESCRIPTION, images: ["/icons/icon-512.png"] },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Cardlist",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
        <LangProvider>{children}</LangProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
