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

// ลูกศรทางเข้างาน — โทนทองตามธีมงาน วาดในแนวนอนแล้วหมุนตามทิศ ข้อความไม่หมุนตาม
const ROT = { right: 0, down: 90, left: 180, up: -90 } as const;
function Entrance({ x, y, len, dir }: NonNullable<BoothLayout["entrance"]>) {
  const head = 16;
  const horizontal = dir === "right" || dir === "left";
  const cx = horizontal ? x + (dir === "right" ? len / 2 : -len / 2) : x;
  const cy = horizontal ? y : y + (dir === "down" ? len / 2 : -len / 2);
  return (
    <g role="img" aria-label="ทางเข้างาน">
      <g transform={`translate(${x} ${y}) rotate(${ROT[dir]})`}>
        <g className="bm-entr-arrow">
          <rect x={0} y={-4} width={len - head + 2} height={8} rx={4} fill="#C9A96E" />
          <polygon points={`${len - head},-12 ${len},0 ${len - head},12`} fill="#A8823F" />
        </g>
      </g>
      <text x={cx} y={cy - 15} textAnchor="middle" fontSize={12} fontWeight={700} fill="#8A6A2F" style={{ fontFamily: "inherit" }}>ทางเข้า</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize={7.5} letterSpacing={2} fill="#8A6A2F" style={{ fontFamily: "inherit" }}>ENTRANCE</text>
    </g>
  );
}

export default function BoothMap({
  layout, stateOf, onToggle, onBookedClick, typeOrder, label, logoOf, onHover,
}: {
  onHover?: (tableId: string | null, rect: DOMRect | null) => void; // ชี้เมาส์/โฟกัส/แตะโต๊ะ → แสดงรายละเอียด
  layout: BoothLayout;
  stateOf: (tableId: string) => TableState;
  onToggle?: (tableId: string) => void;
  onBookedClick?: (tableId: string) => void; // แตะโต๊ะที่ไม่ว่าง (ไว้ดูว่าเป็นร้านไหน)
  typeOrder: string[]; // ประเภทโต๊ะแรกสีกลาง ประเภทถัดไปสีอุ่น
  label?: (tableId: string) => string;
  logoOf?: (tableId: string) => { url: string; name: string } | null; // โลโก้ร้านที่ชำระแล้ว วางทับโต๊ะ
}) {
  const [x, y, w, h] = layout.viewBox;

  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} width="100%" role="group" aria-label="ผังโต๊ะงาน แตะหรือกด Enter ที่โต๊ะเพื่อเลือก" style={{ display: "block" }}>
      <style>{`
        .bm-t{cursor:pointer;outline:none}
        .bm-t rect{fill:#fff;stroke:#a1a1aa;stroke-width:1}
        .bm-t text{font-size:9.5px;fill:#18181b;pointer-events:none;font-family:inherit}
        .bm-t.warm rect{fill:#fef3c7;stroke:#d97706}
        .bm-t:hover rect,.bm-t:focus rect{stroke:#18181b;stroke-width:1.8}
        .bm-t.booked{cursor:help}
        .bm-t.booked rect{fill:#f4f4f5;stroke:#d4d4d8;stroke-dasharray:3 2}
        .bm-t.booked text{fill:#a1a1aa}
        .bm-t.selected rect{fill:#18181b;stroke:#18181b}
        .bm-t.selected text{fill:#fff;font-weight:600}
        .bm-z{cursor:help;outline:none}
        .bm-z rect{fill:transparent;stroke:transparent;stroke-width:2}
        .bm-z:hover rect,.bm-z:focus rect{fill:rgba(201,169,110,.18);stroke:#C9A96E}
        .bm-entr-arrow{animation:bm-nudge 1.6s ease-in-out infinite}
        @keyframes bm-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
        @media (prefers-reduced-motion: reduce){.bm-entr-arrow{animation:none}}
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

      {layout.entrance && <Entrance {...layout.entrance} />}

      {/* พื้นที่พิเศษ (บูธ Sponsor ฯลฯ): ชั้นโปร่งใสวางทับผัง ไว้ชี้/แตะดูรายละเอียด */}
      {layout.zones?.map((z) => (
        <g
          key={z.id}
          className="bm-z"
          tabIndex={0}
          role="img"
          aria-label={`${z.label} ขนาด ${z.size}`}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") onHover?.(z.id, e.currentTarget.getBoundingClientRect()); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") onHover?.(null, null); }}
          onFocus={(e) => onHover?.(z.id, e.currentTarget.getBoundingClientRect())}
          onBlur={() => onHover?.(null, null)}
          onClick={(e) => onHover?.(z.id, e.currentTarget.getBoundingClientRect())}
        >
          <rect x={z.x} y={z.y} width={z.w} height={z.h} />
        </g>
      ))}

      {layout.tables.map((t) => {
        const st = stateOf(t.id);
        const warm = typeOrder.indexOf(t.type) > 0;
        const logo = st === "booked" ? logoOf?.(t.id) ?? null : null;
        return (
          <g
            key={t.id}
            className={`bm-t ${warm ? "warm" : ""} ${st}`}
            role="button"
            tabIndex={0}
            aria-label={label ? label(t.id) : t.id}
            aria-pressed={st === "selected"}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") onHover?.(t.id, e.currentTarget.getBoundingClientRect()); }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") onHover?.(null, null); }}
            onFocus={(e) => onHover?.(t.id, e.currentTarget.getBoundingClientRect())}
            onBlur={() => onHover?.(null, null)}
            onClick={() => (st !== "booked" ? onToggle?.(t.id) : onBookedClick?.(t.id))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (st !== "booked") onToggle?.(t.id);
                else onBookedClick?.(t.id);
              }
            }}
          >
            <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={2} style={logo ? { fill: "#fff", stroke: "#a1a1aa", strokeDasharray: "none" } : undefined} />
            {logo ? (
              <>
                <title>{logo.name}</title>
                <image href={logo.url} x={t.x + 1.5} y={t.y + 1.5} width={t.w - 3} height={t.h - 3} preserveAspectRatio="xMidYMid meet" />
              </>
            ) : (
              <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 3.4} textAnchor="middle">{t.id}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
