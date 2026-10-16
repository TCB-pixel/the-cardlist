"use client";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { useLang } from "@/lib/i18n";

// นโยบายความเป็นส่วนตัว — ใช้ประกอบการส่งแอปขึ้น Google Play / App Store ด้วย
// ถ้าเพิ่มบริการภายนอกที่รับข้อมูลลูกค้า (เช่น analytics) ให้อัปเดตหัวข้อ "ผู้ให้บริการที่เราใช้" และวันที่ด้านล่าง
const CONTACT_EMAIL = "thecardlistbkk@gmail.com";
const UPDATED = { th: "16 ตุลาคม 2569", en: "16 October 2026" };

type Section = { th: { h: string; p: string[] }; en: { h: string; p: string[] } };

const SECTIONS: Section[] = [
  {
    th: {
      h: "ข้อมูลที่เราเก็บ",
      p: [
        "ข้อมูลบัญชี: อีเมล ชื่อผู้ใช้ ชื่อ-นามสกุล วันเกิด เบอร์โทรศัพท์ และรูปโปรไฟล์ หากเข้าสู่ระบบด้วย LINE เราจะได้รับ LINE user ID ชื่อที่แสดง และรูปโปรไฟล์ LINE",
        "ที่อยู่จัดส่ง: ชื่อผู้รับ เบอร์โทร และที่อยู่ที่คุณบันทึกไว้",
        "คำสั่งซื้อและการชำระเงิน: รายการสินค้า ยอดชำระ สถานะการจัดส่ง และเลขพัสดุ — ข้อมูลบัตรเครดิตถูกประมวลผลโดย Stripe เราไม่ได้เก็บเลขบัตรของคุณ",
        "การจองบูธและอีเวนต์: ชื่อร้าน ชื่อผู้ติดต่อ เบอร์โทร ข้อมูลร้านค้า และการยอมรับกฎระเบียบ",
        "ข้อมูลสมาชิก: แต้ม ระดับสมาชิก รหัสสมาชิก คอลเลกชันการ์ด และเด็คที่คุณสร้าง",
        "ข้อความที่ส่งถึง LINE Official Account ของเรา ซึ่งอาจถูกตอบโดยระบบผู้ช่วยอัตโนมัติ",
      ],
    },
    en: {
      h: "Information we collect",
      p: [
        "Account details: email, username, first and last name, date of birth, phone number and profile picture. If you log in with LINE we receive your LINE user ID, display name and profile picture.",
        "Shipping addresses: recipient name, phone number and the addresses you save.",
        "Orders and payments: items, amounts, delivery status and tracking numbers. Card payments are processed by Stripe — we never store your card number.",
        "Booth and event bookings: shop name, contact name, phone number, shop details and your acceptance of the booth rules.",
        "Membership data: points, member tier, member code, card collections and decks you create.",
        "Messages you send to our LINE Official Account, which may be answered by an automated assistant.",
      ],
    },
  },
  {
    th: {
      h: "เราใช้ข้อมูลเพื่ออะไร",
      p: [
        "สร้างและดูแลบัญชีของคุณ ยืนยันตัวตนเมื่อเข้าสู่ระบบ",
        "รับชำระเงิน จัดส่งสินค้า และแจ้งสถานะคำสั่งซื้อทางอีเมลหรือ LINE",
        "จัดการการจองบูธ ตั๋ว และการเข้างานอีเวนต์",
        "คำนวณแต้มและสิทธิประโยชน์สมาชิก",
        "ตอบคำถามและให้บริการลูกค้า",
        "ปฏิบัติตามกฎหมาย เช่น การเก็บหลักฐานทางบัญชีและภาษี",
      ],
    },
    en: {
      h: "How we use it",
      p: [
        "To create and manage your account and verify you when you log in.",
        "To take payment, ship your orders and send order updates by email or LINE.",
        "To manage booth bookings, tickets and event entry.",
        "To calculate points and member benefits.",
        "To answer your questions and provide customer support.",
        "To meet legal obligations such as keeping accounting and tax records.",
      ],
    },
  },
  {
    th: {
      h: "ผู้ให้บริการที่เราใช้",
      p: [
        "เราไม่ขายข้อมูลส่วนบุคคลของคุณ เราแบ่งปันข้อมูลเท่าที่จำเป็นกับผู้ให้บริการต่อไปนี้เพื่อให้บริการแก่คุณ:",
        "Supabase (ฐานข้อมูลและระบบเข้าสู่ระบบ) · Vercel (โฮสต์เว็บไซต์) · Stripe (รับชำระเงิน) · LINE (เข้าสู่ระบบและส่งข้อความ) · Resend (ส่งอีเมล) · Loyverse (ระบบขายหน้าร้านและสต็อก) · iShip และบริษัทขนส่ง (จัดส่งพัสดุ) · Anthropic (ระบบผู้ช่วยตอบข้อความ LINE)",
      ],
    },
    en: {
      h: "Service providers",
      p: [
        "We do not sell your personal data. We share only what is needed with these providers so we can serve you:",
        "Supabase (database and login) · Vercel (website hosting) · Stripe (payments) · LINE (login and messaging) · Resend (email delivery) · Loyverse (point of sale and stock) · iShip and couriers (shipping) · Anthropic (automated replies to LINE messages)",
      ],
    },
  },
  {
    th: {
      h: "การเก็บรักษาและความปลอดภัย",
      p: [
        "ข้อมูลถูกส่งผ่านการเชื่อมต่อที่เข้ารหัส (HTTPS) และจำกัดสิทธิ์การเข้าถึงเฉพาะทีมงานที่เกี่ยวข้อง",
        "เราเก็บข้อมูลบัญชีไว้ตราบเท่าที่คุณยังใช้บริการ ข้อมูลคำสั่งซื้อและการชำระเงินจะถูกเก็บตามระยะเวลาที่กฎหมายบัญชีและภาษีกำหนด",
      ],
    },
    en: {
      h: "Retention and security",
      p: [
        "Data is sent over encrypted connections (HTTPS) and access is limited to the staff who need it.",
        "We keep your account data for as long as you use the service. Order and payment records are kept for the period required by accounting and tax law.",
      ],
    },
  },
  {
    th: {
      h: "สิทธิของคุณ",
      p: [
        "คุณมีสิทธิขอเข้าถึง แก้ไข หรือขอสำเนาข้อมูลส่วนบุคคลของคุณ ขอให้ลบข้อมูล หรือคัดค้านการใช้ข้อมูล ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
        "คุณแก้ไขข้อมูลโปรไฟล์และที่อยู่ได้เองในหน้าโปรไฟล์ และขอลบบัญชีได้ที่หน้า “ลบบัญชี”",
      ],
    },
    en: {
      h: "Your rights",
      p: [
        "Under Thailand's Personal Data Protection Act (PDPA) you can ask to access, correct or get a copy of your personal data, ask us to delete it, or object to how we use it.",
        "You can edit your profile and addresses yourself on the Profile page, and request account deletion on the “Delete account” page.",
      ],
    },
  },
  {
    th: {
      h: "เด็กและเยาวชน",
      p: ["บริการของเราไม่ได้ออกแบบมาสำหรับเด็กอายุต่ำกว่า 13 ปี หากผู้ปกครองพบว่าบุตรหลานให้ข้อมูลกับเรา โปรดติดต่อเพื่อให้เราลบข้อมูล"],
    },
    en: {
      h: "Children",
      p: ["Our service is not directed at children under 13. If you believe a child has given us personal data, please contact us and we will delete it."],
    },
  },
];

export default function PrivacyPage() {
  const { lang, L } = useLang();
  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <TopBar title={L("นโยบายความเป็นส่วนตัว", "Privacy Policy")} showBack />
      <main className="px-5 py-5 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-zinc-900">{L("นโยบายความเป็นส่วนตัว", "Privacy Policy")}</h1>
        <p className="text-[11px] text-zinc-500 mt-1">
          {L("ปรับปรุงล่าสุด", "Last updated")} {UPDATED[lang]}
        </p>
        <p className="text-sm text-zinc-700 leading-relaxed mt-4">
          {L(
            "The Cardlist (“เรา”) ให้ความสำคัญกับข้อมูลส่วนบุคคลของคุณ นโยบายนี้อธิบายว่าเราเก็บ ใช้ และดูแลข้อมูลอย่างไร เมื่อคุณใช้เว็บไซต์ thecardlistbkk.com และแอป The Cardlist",
            "The Cardlist (“we”) cares about your personal data. This policy explains what we collect, how we use it and how we look after it when you use thecardlistbkk.com and the The Cardlist app."
          )}
        </p>

        {SECTIONS.map((s) => {
          const c = s[lang];
          return (
            <section key={s.en.h} className="mt-6">
              <h2 className="text-sm font-semibold text-zinc-900">{c.h}</h2>
              <ul className="mt-2 space-y-2">
                {c.p.map((t) => (
                  <li key={t} className="text-sm text-zinc-700 leading-relaxed">{t}</li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="mt-6 card p-4">
          <h2 className="text-sm font-semibold text-zinc-900">{L("ติดต่อเรา", "Contact us")}</h2>
          <p className="text-sm text-zinc-700 leading-relaxed mt-2">
            {L("คำถามเกี่ยวกับข้อมูลส่วนบุคคล ติดต่อได้ที่", "For privacy questions, email")}{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
          </p>
          <Link href="/account/delete" className="btn-outline inline-block mt-3">
            {L("ขอลบบัญชี", "Request account deletion")}
          </Link>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
