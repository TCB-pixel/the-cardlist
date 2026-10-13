import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "การ์ดศิลปินไทย",
  description: "รวมผลงานการ์ดจากศิลปินไทย คัดสรรโดย The Cardlist",
  openGraph: { title: "การ์ดศิลปินไทย | The Cardlist", description: "รวมผลงานการ์ดจากศิลปินไทย คัดสรรโดย The Cardlist" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
