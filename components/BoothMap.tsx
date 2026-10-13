"use client";
import type { BoothLayout } from "@/lib/booth-layout";

// วาดผังโต๊ะจากข้อมูลที่แปลงจากไฟล์ SVG — ใช้ทั้งหน้าจองของ Vendor และหน้าแอดมิน
export type TableState = "free" | "booked" | "selected";

// สีที่แปลงจากไฟล์ผังอาจเป็นตัวแปรของระบบอื่น — แปลงเป็นสีของเว็บเรา
const COLOR: Record<string, string> = {
  "var(--surface-1)": "#f4f4f5",
  "var(--text-primary)": "#18181b",
};
const col = (c: string) => COLOR[c] ?? c;

export default function BoothMap({
  layout, stateOf, onToggle, typeOrder, label,
}: {
  layout: BoothLayout;
  stateOf: (tableId: string) => TableState;
  onToggle?: (tableId: string) => void;
  typeOrder: string[]; // ประเภทโต๊ะแรกสีกลาง ประเภทถัดไปสีอุ่น
  label?: (tableId: string) => string;
}) {
  const [x, y, w, h] = layout.viewBox;

  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width="100%" role="img" aria-label="ผังโต๊ะงาน" style={{ display: "block" }}>
      <style>{`
        .bm-t{cursor:pointer;outline:none}
        .bm-t rect{fill:#fff;stroke:#a1a1aa;stroke-width:1}
        .bm-t text{font-size:9.5px;fill:#18181b;pointer-events:none;font-family:inherit}
        .bm-t.warm rect{fill:#fef3c7;stroke:#d97706}
        .bm-t:hover rect,.bm-t:focus rect{stroke:#18181b;stroke-width:1.8}
        .bm-t.booked{cursor:not-allowed}
        .bm-t.booked rect{fill:#f4f4f5;stroke:#d4d4d8;stroke-dasharray:3 2}
        .bm-t.booked text{fill:#a1a1aa}
        .bm-t.selected rect{fill:#18181b;stroke:#18181b}
        .bm-t.selected text{fill:#fff;font-weight:600}
      `}</style>

      {layout.shapes.map((s, i) =>
        s.kind === "ellipse" ? (
          <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={col(s.fill)} stroke={col(s.stroke)} strokeWidth={s.strokeWidth} />
        ) : s.closed ? (
          <polygon key={i} points={s.points.map((p) => p.join(",")).join(" ")} fill={col(s.fill)} stroke={col(s.stroke)} strokeWidth={s.strokeWidth} />
        ) : (
          <polyline key={i} points={s.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={col(s.stroke)} strokeWidth={s.strokeWidth} />
        )
      )}

      {layout.texts.map((t, i) => (
        <text key={i} x={t.x} y={t.y} fontSize={t.size} fill={col(t.fill)} textAnchor={t.anchor} style={{ fontFamily: "inherit" }}>
          {t.text}
        </text>
      ))}

      {layout.tables.map((t) => {
        const st = stateOf(t.id);
        const warm = typeOrder.indexOf(t.type) > 0;
        return (
          <g
            key={t.id}
            className={`bm-t ${warm ? "warm" : ""} ${st}`}
            role="button"
            tabIndex={st === "booked" ? -1 : 0}
            aria-label={label ? label(t.id) : t.id}
            aria-pressed={st === "selected"}
            onClick={() => st !== "booked" && onToggle?.(t.id)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && st !== "booked") {
                e.preventDefault();
                onToggle?.(t.id);
              }
            }}
          >
            <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={2} />
            <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 3.4} textAnchor="middle">{t.id}</text>
          </g>
        );
      })}
    </svg>
  );
}
