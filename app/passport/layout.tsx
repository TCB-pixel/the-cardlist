import type { Metadata, Viewport } from "next";
import "./passport.css";

export const metadata: Metadata = {
  title: "CARDLIST PASSPORT",
  description: "สะสมแสตมป์ 3 งานของ The Cardlist — สแกน QR ตามจุดในงาน ฉีกซองลุ้นรางวัล และ Learn To Play ฟรี",
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#141414" };

export default function PassportLayout({ children }: { children: React.ReactNode }) {
  return <div className="pp">{children}</div>;
}
