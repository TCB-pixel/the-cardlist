import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว",
  description: "นโยบายความเป็นส่วนตัวของ The Cardlist — ข้อมูลที่เราเก็บ วิธีใช้ และสิทธิของคุณ",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
