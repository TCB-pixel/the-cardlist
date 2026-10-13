import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "จองโต๊ะ Vendor",
  description: "เลือกโต๊ะร้านค้าจากผังงานจริง แล้วชำระเงินได้ทันที สำหรับร้านค้าที่ออกบูธในงาน The Cardlist",
  openGraph: { title: "จองโต๊ะ Vendor | The Cardlist", description: "เลือกโต๊ะร้านค้าจากผังงานจริง แล้วชำระเงินได้ทันที สำหรับร้านค้าที่ออกบูธในงาน The Cardlist" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
