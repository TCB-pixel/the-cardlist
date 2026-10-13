import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "โปรไฟล์ของฉัน",
  description: "โปรไฟล์และสิทธิ์สมาชิก The Cardlist",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
