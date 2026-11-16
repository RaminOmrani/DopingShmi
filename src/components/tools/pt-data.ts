/**
 * داده‌ی نمایشی جدول تناوبی (خالص؛ بدون React): جای هر عنصر در شبکه، رنگ دسته‌ها و جست‌وجو.
 * رنگ‌ها از توکن‌های تم ساخته می‌شوند (var(--color-…))، پس در حالت روشن و تیره و چاپ خودکار عوض می‌شوند.
 */
import { ELEMENTS, type Category, type ChemElement } from "@/lib/chem/elements";

/** ترتیب دسته‌ها در راهنمای رنگ */
export const CAT_ORDER: Category[] = [
  "alkali",
  "alkaline-earth",
  "transition",
  "post-transition",
  "metalloid",
  "nonmetal",
  "halogen",
  "noble-gas",
  "lanthanide",
  "actinide",
];

/** رنگ هر دسته (عبارت CSS بر پایه‌ی توکن‌های تم؛ ده رنگ از هفت توکن با color-mix) */
export const CAT_COLOR: Record<Category, string> = {
  alkali: "var(--color-rose)",
  "alkaline-earth": "color-mix(in oklab, var(--color-rose) 45%, var(--color-amber))",
  transition: "color-mix(in oklab, var(--color-cyan) 50%, var(--color-violet))",
  "post-transition": "var(--color-teal)",
  metalloid: "var(--color-lime)",
  nonmetal: "var(--color-amber)",
  halogen: "var(--color-cyan)",
  "noble-gas": "var(--color-violet)",
  lanthanide: "var(--color-magenta)",
  actinide: "color-mix(in oklab, var(--color-magenta) 50%, var(--color-rose))",
};

/**
 * جای عنصر در شبکه‌ی CSS: ستون ۱ شماره‌ی دوره، ستون‌های ۲ تا ۱۹ گروه‌های ۱ تا ۱۸؛ سطر ۱ شماره‌ی گروه،
 * سطرهای ۲ تا ۸ دوره‌های ۱ تا ۷، سطر ۹ فاصله و سطرهای ۱۰ و ۱۱ لانتانیدها و آکتینیدها (از ستون گروه ۳).
 */
export function cellPos(e: ChemElement): { row: number; col: number } {
  if (e.z >= 57 && e.z <= 71) return { row: 10, col: e.z - 57 + 4 };
  if (e.z >= 89 && e.z <= 103) return { row: 11, col: e.z - 89 + 4 };
  return { row: e.period + 1, col: (e.group ?? 3) + 1 };
}

const POS = new Map(ELEMENTS.map((e) => [e.z, cellPos(e)]));
const AT = new Map(ELEMENTS.map((e) => [`${POS.get(e.z)!.row},${POS.get(e.z)!.col}`, e.z]));

/** عنصر بعدی در یک جهت (برای کلیدهای جهت‌نما)؛ خانه‌های خالی رد می‌شوند */
export function neighbor(z: number, dr: number, dc: number): number | null {
  const p = POS.get(z);
  if (!p) return null;
  let { row, col } = p;
  for (let i = 0; i < 20; i++) {
    row += dr;
    col += dc;
    if (row < 2 || row > 11 || col < 2 || col > 19) return null;
    const t = AT.get(`${row},${col}`);
    if (t) return t;
  }
  return null;
}

/** نخستین یا آخرین عنصر همان سطر (کلیدهای Home و End) */
export function rowEdge(z: number, end: boolean): number {
  const row = POS.get(z)!.row;
  const inRow = ELEMENTS.filter((e) => POS.get(e.z)!.row === row).sort((a, b) => POS.get(a.z)!.col - POS.get(b.z)!.col);
  return (end ? inRow[inRow.length - 1] : inRow[0]).z;
}

/** یکسان‌سازی متن جست‌وجو: ی/ک عربی، نیم‌فاصله، فاصله و رقم فارسی */
export function searchKey(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎\s]/g, "")
    .toLowerCase();
}

/**
 * عنصرهای منطبق با جست‌وجو، مرتب از بهترین تطابق: عدد اتمی، نماد دقیق، نام دقیق، شروع نام، بخشی از نام.
 */
export function searchElements(query: string): ChemElement[] {
  const q = searchKey(query);
  if (!q) return [];
  if (/^\d+$/.test(q)) {
    const e = ELEMENTS[Number(q) - 1];
    return e ? [e] : [];
  }
  const scored: { e: ChemElement; s: number }[] = [];
  for (const e of ELEMENTS) {
    const fa = searchKey(e.fa);
    const en = e.en.toLowerCase();
    const sym = e.symbol.toLowerCase();
    let s = 0;
    if (sym === q) s = 100;
    else if (fa === q || en === q) s = 90;
    else if (fa.startsWith(q) || en.startsWith(q)) s = 60;
    else if (q.length >= 2 && (fa.includes(q) || en.includes(q))) s = 30;
    if (s) scored.push({ e, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.e.z - b.e.z).map((x) => x.e);
}

/** آرایش الکترونی به نحو Chem: «[Ar] 3d6 4s2» → «[Ar] 3d^6 4s^2» */
export const configChem = (config: string) => config.replace(/([spdf])(\d+)/g, "$1^$2");
