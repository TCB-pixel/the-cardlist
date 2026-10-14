// ใช้ในหัวข้อ/heading เท่านั้น: คำว่า "The Cardlist" จะแสดงด้วยฟอนต์แบรนด์ CardlistDisplay
// ส่วนอื่นของข้อความ (รวมถึงภาษาไทย) ใช้ฟอนต์ระบบตามเดิม — เนื้อหา/บทความไม่ต้องใช้คอมโพเนนต์นี้
const BRAND_RE = /(the cardlist)/i;

export default function BrandText({ text }: { text: string }) {
  const parts = text.split(BRAND_RE);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-cardlist font-normal tracking-wide">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
}
