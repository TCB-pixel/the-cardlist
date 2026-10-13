import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ร้านค้าการ์ดเกม",
  description: "ซื้อการ์ดเกม กล่อง ซอง และอุปกรณ์ Pokémon, One Piece, MTG และอีกมากมาย พร้อมสินค้าพรีออเดอร์",
  openGraph: { title: "ร้านค้าการ์ดเกม | The Cardlist", description: "ซื้อการ์ดเกม กล่อง ซอง และอุปกรณ์ Pokémon, One Piece, MTG และอีกมากมาย พร้อมสินค้าพรีออเดอร์" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
