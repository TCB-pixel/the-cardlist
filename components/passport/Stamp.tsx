// ตราแสตมป์สีทอง ขอบหมึกไม่เรียบ + ตัวหนังสือรอบตราหมุน (big) — ไอคอนตามลำดับจุด
const ICON = [
  "M100 62 l10 24 26 2 -20 17 6 26 -22 -14 -22 14 6 -26 -20 -17 26 -2z",
  "M100 64a36 36 0 1 0 .1 0z M100 76v24l16 10",
  "M88 64h24v40h-24z M78 98a22 22 0 0 0 44 0 M100 120v12 M86 134h28",
  "M72 96h56v34h-56z M100 96v34 M72 96l28-22 28 22",
];

export default function Stamp({ index, label, ring, size = 64 }: { index: number; label?: string; ring?: string; size?: number }) {
  const id = `s${index}${size}`;
  const big = size > 100;
  const txt = ring ? (ring + " · ").repeat(3) : "";
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-label={label} role="img">
      <defs>
        <path id={`c${id}`} d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
        <filter id={`ink${id}`}><feTurbulence baseFrequency="0.9" numOctaves={2} seed={index + 3} /><feDisplacementMap in="SourceGraphic" scale={5} /></filter>
      </defs>
      <g filter={`url(#ink${id})`} fill="none" stroke="#c9a85c" strokeWidth={4}>
        <circle cx="100" cy="100" r="92" fill="#1f1a10" />
        <circle cx="100" cy="100" r="58" strokeWidth={2.5} />
        <path d={ICON[index % ICON.length]} strokeWidth={5} strokeLinejoin="round" />
      </g>
      {big && txt && (
        <g className="pp-spin">
          <text fontSize="14" letterSpacing="2" fill="#c9a85c"><textPath href={`#c${id}`}>{txt}</textPath></text>
        </g>
      )}
    </svg>
  );
}
