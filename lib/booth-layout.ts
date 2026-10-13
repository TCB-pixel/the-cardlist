// แปลงไฟล์ผัง SVG (ส่งออกจาก Illustrator/Figma ฯลฯ) เป็นข้อมูลผังโต๊ะ
// กติกา: ข้อความที่ขึ้นต้นด้วยตัวอักษร 1–3 ตัวตามด้วยเลข (เช่น A01, S08) คือเลขโต๊ะ
// และกรอบสี่เหลี่ยมที่ครอบตำแหน่งข้อความนั้นคือตัวโต๊ะ — ตำแหน่งและขนาดอ่านจากไฟล์ตรง ๆ ไม่เดา

export type BoothTable = { id: string; type: string; x: number; y: number; w: number; h: number };
export type BoothShape =
  | { kind: "poly"; points: [number, number][]; closed: boolean; fill: string; stroke: string; strokeWidth: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: string; stroke: string; strokeWidth: number };
export type BoothText = { text: string; x: number; y: number; size: number; fill: string; anchor: "start" | "middle" | "end" };
export type BoothLayout = {
  viewBox: [number, number, number, number]; // ส่วนของผังที่แสดง (x y กว้าง สูง)
  source: [number, number]; // ขนาดผังต้นฉบับ
  tables: BoothTable[];
  shapes: BoothShape[];
  texts: BoothText[];
};

const TABLE_LABEL = /^[A-Z]{1,3}\d{1,3}$/;

function decode(s: string) {
  return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]] = decode(m[2]);
  return out;
}

type Style = Record<string, string>;
function parseStyles(svg: string): Record<string, Style> {
  const styles: Record<string, Style> = {};
  const block = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(svg)?.[1] ?? "";
  const re = /\.([\w-]+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(decode(block)))) {
    const st: Style = {};
    for (const decl of m[2].split(";")) {
      const i = decl.indexOf(":");
      if (i > 0) st[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
    styles[m[1]] = st;
  }
  return styles;
}

// สีจากไฟล์ → สีที่แสดงได้ทั้งโหมดสว่าง/มืด (ไล่เฉดเทาแทนกราเดียนต์)
function paint(v: string | undefined, kind: "fill" | "stroke" | "text"): string {
  if (!v || v === "none") return "none";
  if (v.startsWith("url(")) {
    if (/gold/i.test(v)) return "#dbb155";
    if (/gunmetal/i.test(v)) return "#444441";
    return "#9ea7a7";
  }
  const c = v.toLowerCase();
  if (c === "#000" || c === "#000000") return kind === "text" ? "var(--text-primary)" : "#2C2C2A";
  if (c === "#fff" || c === "#ffffff") return kind === "text" ? "#ffffff" : "var(--surface-1)";
  return v;
}

function num(s: string | undefined, d = 0) {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : d;
}

function pathPoints(d: string): { points: [number, number][]; curved: boolean; closed: boolean } {
  const curved = /[CcSsQqAa]/.test(d);
  const closed = /[Zz]/.test(d);
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const points: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
  return { points, curved, closed };
}

function bbox(points: [number, number][]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function textAnchor(tr: string | undefined): [number, number] {
  const m = /matrix\(\s*([-\d.e\s,]+)\)/i.exec(tr ?? "");
  if (!m) return [0, 0];
  const p = m[1].split(/[\s,]+/).map(Number);
  return [p[4] ?? 0, p[5] ?? 0];
}

export function parseBoothSvg(svg: string): BoothLayout {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1].split(/[\s,]+/).map(Number);
  if (!vb || vb.length < 4 || vb.some((n) => !Number.isFinite(n))) throw new Error("ไฟล์ SVG ไม่มี viewBox");
  const [, , srcW, srcH] = vb;
  const styles = parseStyles(svg);
  const styleOf = (cls: string | undefined): Style => {
    const merged: Style = {};
    for (const c of (cls ?? "").split(/\s+/)) Object.assign(merged, styles[c] ?? {});
    return merged;
  };

  // ── ข้อความ ──
  type T = { text: string; x: number; y: number; size: number; fill: string; anchor: "start" | "middle" | "end" };
  const texts: T[] = [];
  const textRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let tm: RegExpExecArray | null;
  while ((tm = textRe.exec(svg))) {
    const a = attrs(tm[1]);
    const st = styleOf(a.class);
    const [tx, ty] = textAnchor(a.transform);
    const size = num(st["font-size"], 12);
    const anchor = (st["text-anchor"] as T["anchor"]) || "start";
    const fill = paint(st.fill, "text");
    const spans = [...tm[2].matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];
    if (spans.length === 0) {
      const t = decode(tm[2].replace(/<[^>]+>/g, "")).trim();
      if (t) texts.push({ text: t, x: tx + num(a.x), y: ty + num(a.y), size, fill, anchor });
    } else {
      for (const sp of spans) {
        const sa = attrs(sp[1]);
        const t = decode(sp[2].replace(/<[^>]+>/g, "")).trim();
        if (t) texts.push({ text: t, x: tx + num(sa.x, num(a.x)), y: ty + num(sa.y, num(a.y)), size, fill, anchor });
      }
    }
  }

  // ── รูปทรง ──
  type P = { points: [number, number][]; curved: boolean; closed: boolean; fill: string; stroke: string; sw: number };
  const paths: P[] = [];
  const pathRe = /<path\b([^>]*?)\/?>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pathRe.exec(svg))) {
    const a = attrs(pm[1]);
    if (!a.d) continue;
    const { points, curved, closed } = pathPoints(a.d);
    if (points.length < 2) continue;
    const st = styleOf(a.class);
    paths.push({
      points, curved, closed,
      fill: paint(st.fill, "fill"),
      stroke: paint(st.stroke, "stroke"),
      sw: num(st["stroke-width"], 1),
    });
  }

  // ตัวโต๊ะ = กรอบสี่เหลี่ยมที่ครอบตำแหน่งป้ายเลขโต๊ะ (เลือกกรอบที่เล็กที่สุด)
  const rects = paths
    .filter((p) => !p.curved && p.closed && p.points.length >= 4 && p.points.length <= 5)
    .map((p) => ({ p, ...bbox(p.points) }))
    .filter((r) => r.w >= 10 && r.w <= 120 && r.h >= 10 && r.h <= 120);

  const tables: BoothTable[] = [];
  const usedRects = new Set<(typeof rects)[number]>();
  const tableTextIdx = new Set<number>();
  const seen = new Set<string>();
  texts.forEach((t, i) => {
    if (!TABLE_LABEL.test(t.text)) return;
    // ป้ายอยู่ในกรอบ: เช็คที่จุด baseline ของข้อความ (เยื้องเข้ามาเล็กน้อย)
    const px = t.x + 4;
    const py = t.y - 2;
    const hit = rects
      .filter((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (!hit) return;
    if (seen.has(t.text)) throw new Error(`เลขโต๊ะซ้ำในไฟล์ผัง: ${t.text}`);
    seen.add(t.text);
    tableTextIdx.add(i);
    tables.push({
      id: t.text,
      type: t.text.replace(/\d+$/, ""),
      x: round(hit.x), y: round(hit.y), w: round(hit.w), h: round(hit.h),
    });
    // กรอบอื่นที่ซ้อนตำแหน่งเดียวกัน (เช่น ชั้นสีทับ) ไม่ต้องวาดซ้ำ
    for (const r of rects) {
      if (Math.abs(r.x - hit.x) < 1.5 && Math.abs(r.y - hit.y) < 1.5 && Math.abs(r.w - hit.w) < 1.5 && Math.abs(r.h - hit.h) < 1.5) usedRects.add(r);
    }
  });
  if (tables.length === 0) throw new Error("ไม่พบเลขโต๊ะในไฟล์ผัง (ต้องเป็นข้อความเช่น A01, S02 อยู่ในกรอบโต๊ะ)");

  const shapes: BoothShape[] = [];
  for (const p of paths) {
    const bb = bbox(p.points);
    if (rects.some((r) => r.p === p && usedRects.has(r))) continue;
    if (p.fill === "none" && p.stroke === "none") continue;
    if (bb.w < 0.5 && bb.h < 0.5) continue;
    // ข้ามรูปที่อยู่นอกพื้นที่ผังทั้งหมด
    if (bb.x > srcW || bb.y > srcH || bb.x + bb.w < 0 || bb.y + bb.h < 0) continue;
    if (p.curved) {
      shapes.push({
        kind: "ellipse",
        cx: round(bb.x + bb.w / 2), cy: round(bb.y + bb.h / 2), rx: round(bb.w / 2), ry: round(bb.h / 2),
        fill: p.fill, stroke: p.stroke, strokeWidth: p.sw,
      });
    } else {
      shapes.push({
        kind: "poly",
        points: p.points.map(([x, y]) => [round(x), round(y)] as [number, number]),
        closed: p.closed, fill: p.fill, stroke: p.stroke, strokeWidth: p.sw,
      });
    }
  }

  const decorTexts: BoothText[] = texts
    .filter((_, i) => !tableTextIdx.has(i))
    .map((t) => ({ ...t, x: round(t.x), y: round(t.y) }));

  // มุมมองตั้งต้น: ครอบกลุ่มโต๊ะ + ขอบ 110 หน่วย (แอดมินปรับได้ภายหลัง)
  const bb = bbox(tables.flatMap((t) => [[t.x, t.y], [t.x + t.w, t.y + t.h]] as [number, number][]));
  const pad = 110;
  const x0 = Math.max(0, bb.x - pad), y0 = Math.max(0, bb.y - pad);
  const x1 = Math.min(srcW, bb.x + bb.w + pad), y1 = Math.min(srcH, bb.y + bb.h + pad);

  return {
    viewBox: [round(x0), round(y0), round(x1 - x0), round(y1 - y0)],
    source: [srcW, srcH],
    tables: tables.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })),
    shapes,
    texts: decorTexts,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
