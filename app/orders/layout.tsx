import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ประวัติการสั่งซื้อ",
  description: "ประวัติคำสั่งซื้อของคุณ",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
