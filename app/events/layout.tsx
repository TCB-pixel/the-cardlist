import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "อีเวนต์และการจอง",
  description: "ติดตามงานอีเวนต์ The Cardlist ลงทะเบียนเข้างาน และจองโต๊ะเทรดการ์ด",
  openGraph: { title: "อีเวนต์และการจอง | The Cardlist", description: "ติดตามงานอีเวนต์ The Cardlist ลงทะเบียนเข้างาน และจองโต๊ะเทรดการ์ด" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
