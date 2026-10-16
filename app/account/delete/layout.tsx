import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ลบบัญชี",
  description: "ขอลบบัญชี The Cardlist และข้อมูลส่วนบุคคลของคุณ",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
