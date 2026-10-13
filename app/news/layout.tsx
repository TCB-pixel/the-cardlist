import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ข่าวสารและบทความ",
  description: "ข่าวการ์ดเกม สรุปงานอีเวนต์ และประกาศจาก The Cardlist",
  openGraph: { title: "ข่าวสารและบทความ | The Cardlist", description: "ข่าวการ์ดเกม สรุปงานอีเวนต์ และประกาศจาก The Cardlist" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
