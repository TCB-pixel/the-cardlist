import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "สมัครสมาชิก",
  description: "สมัครสมาชิก The Cardlist ด้วย LINE หรืออีเมล",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
