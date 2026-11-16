/**
 * داده‌ی ۱۱۸ عنصر جدول دوره‌ای (خالص و ایزومورفیک؛ بدون وابستگی).
 *
 * - نام فارسی ۷۹ عنصر اول عیناً از ELEMENTS در src/lib/constants.ts کپی شده (آزمون برابری دارد)؛ بقیه با املای رایج کتاب درسی.
 * - جرم اتمی از masses.ts (IUPAC/CIAAW ۲۰۲۱؛ برای پرتوزاها عدد جرمی پایدارترین ایزوتوپ).
 * - آرایش الکترونی حالت پایه با نماد گاز نجیب و زیرلایه‌ها به ترتیب n؛ برای Z ≥ ۱۰۴ پیش‌بینی‌شده است.
 * - الکترونگاتیوی پائولینگ از مقدارهای مرجع رایج (null برای گازهای نجیب سبک و عنصرهای بی‌داده).
 * - حالت فیزیکی در ۲۵ درجه؛ از Z = ۱۰۰ به بعد نمونه‌ی ماکروسکوپی ساخته نشده («نامعلوم»).
 * - یون‌های رایج فقط برای عنصرهای اصلی (دسته‌های s و p).
 * - گروه برای ردیف‌های لانتانیدها و آکتینیدها null است و هر ۱۵ عنصر این دو ردیف (La–Lu و Ac–Lr) به قرارداد
 *   جدول‌های رایج در دسته‌ی f نمایش داده می‌شوند (La، Ac، Lu و Lr عنصرهای مرزی‌اند).
 * این فایل فقط برای صفحه‌ی جدول تناوبی است؛ ابزار جرم مولی از masses.ts استفاده کند.
 */
import { ATOMIC_MASS, MASS_NUMBER_ONLY } from "./masses";

export type Block = "s" | "p" | "d" | "f";
export type Category =
  | "alkali"
  | "alkaline-earth"
  | "transition"
  | "lanthanide"
  | "actinide"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble-gas";
export type PhaseAt25 = "solid" | "liquid" | "gas" | "unknown";

/** برچسب فارسی دسته‌ها (برای راهنمای رنگ جدول) */
export const CATEGORY_FA: Record<Category, string> = {
  alkali: "فلز قلیایی",
  "alkaline-earth": "فلز قلیایی خاکی",
  transition: "فلز واسطه",
  lanthanide: "لانتانید",
  actinide: "آکتینید",
  "post-transition": "فلز پس‌واسطه",
  metalloid: "شبه‌فلز",
  nonmetal: "نافلز",
  halogen: "هالوژن",
  "noble-gas": "گاز نجیب",
};

export const PHASE_FA: Record<PhaseAt25, string> = { solid: "جامد", liquid: "مایع", gas: "گاز", unknown: "نامعلوم" };

export interface ChemElement {
  z: number;
  symbol: string;
  /** نام فارسی */
  fa: string;
  /** نام انگلیسی (املای IUPAC) */
  en: string;
  /** جرم اتمی (g/mol) */
  mass: number;
  /** متن جرم برای جدول: «55.845» یا «[98]» */
  massText: string;
  /** جرم استاندارد ندارد؛ mass عدد جرمی پایدارترین ایزوتوپ است */
  massNumberOnly: boolean;
  /** هیچ ایزوتوپ پایداری ندارد (Tc، Pm و Z ≥ ۸۴) */
  radioactive: boolean;
  period: number;
  /** ۱ تا ۱۸؛ null برای ردیف لانتانیدها و آکتینیدها */
  group: number | null;
  block: Block;
  category: Category;
  /** آرایش الکترونی فشرده، مثل «[Ar] 3d6 4s2» */
  config: string;
  /** آرایش، دسته و حالت پیش‌بینی‌شده است (Z ≥ ۱۰۴) */
  predicted: boolean;
  /** الکترونگاتیوی پائولینگ */
  electronegativity: number | null;
  phase: PhaseAt25;
  /** بار یون‌های رایج (فقط عنصرهای اصلی) */
  ions: number[];
}

type PhaseCode = "s" | "l" | "g" | "u";
type Row = [z: number, symbol: string, fa: string, en: string, config: string, en: number | null, phase: PhaseCode, ions?: number[]];

// [Z، نماد، نام فارسی، نام انگلیسی، آرایش الکترونی، الکترونگاتیوی، حالت در ۲۵ درجه، یون‌های رایج]
const ROWS: Row[] = [
  [1, "H", "هیدروژن", "Hydrogen", "1s1", 2.2, "g", [1, -1]],
  [2, "He", "هلیم", "Helium", "1s2", null, "g"],
  [3, "Li", "لیتیم", "Lithium", "[He] 2s1", 0.98, "s", [1]],
  [4, "Be", "بریلیم", "Beryllium", "[He] 2s2", 1.57, "s", [2]],
  [5, "B", "بور", "Boron", "[He] 2s2 2p1", 2.04, "s"],
  [6, "C", "کربن", "Carbon", "[He] 2s2 2p2", 2.55, "s"],
  [7, "N", "نیتروژن", "Nitrogen", "[He] 2s2 2p3", 3.04, "g", [-3]],
  [8, "O", "اکسیژن", "Oxygen", "[He] 2s2 2p4", 3.44, "g", [-2]],
  [9, "F", "فلوئور", "Fluorine", "[He] 2s2 2p5", 3.98, "g", [-1]],
  [10, "Ne", "نئون", "Neon", "[He] 2s2 2p6", null, "g"],
  [11, "Na", "سدیم", "Sodium", "[Ne] 3s1", 0.93, "s", [1]],
  [12, "Mg", "منیزیم", "Magnesium", "[Ne] 3s2", 1.31, "s", [2]],
  [13, "Al", "آلومینیم", "Aluminium", "[Ne] 3s2 3p1", 1.61, "s", [3]],
  [14, "Si", "سیلیسیم", "Silicon", "[Ne] 3s2 3p2", 1.9, "s"],
  [15, "P", "فسفر", "Phosphorus", "[Ne] 3s2 3p3", 2.19, "s", [-3]],
  [16, "S", "گوگرد", "Sulfur", "[Ne] 3s2 3p4", 2.58, "s", [-2]],
  [17, "Cl", "کلر", "Chlorine", "[Ne] 3s2 3p5", 3.16, "g", [-1]],
  [18, "Ar", "آرگون", "Argon", "[Ne] 3s2 3p6", null, "g"],
  [19, "K", "پتاسیم", "Potassium", "[Ar] 4s1", 0.82, "s", [1]],
  [20, "Ca", "کلسیم", "Calcium", "[Ar] 4s2", 1.0, "s", [2]],
  [21, "Sc", "اسکاندیم", "Scandium", "[Ar] 3d1 4s2", 1.36, "s"],
  [22, "Ti", "تیتانیم", "Titanium", "[Ar] 3d2 4s2", 1.54, "s"],
  [23, "V", "وانادیم", "Vanadium", "[Ar] 3d3 4s2", 1.63, "s"],
  [24, "Cr", "کروم", "Chromium", "[Ar] 3d5 4s1", 1.66, "s"],
  [25, "Mn", "منگنز", "Manganese", "[Ar] 3d5 4s2", 1.55, "s"],
  [26, "Fe", "آهن", "Iron", "[Ar] 3d6 4s2", 1.83, "s"],
  [27, "Co", "کبالت", "Cobalt", "[Ar] 3d7 4s2", 1.88, "s"],
  [28, "Ni", "نیکل", "Nickel", "[Ar] 3d8 4s2", 1.91, "s"],
  [29, "Cu", "مس", "Copper", "[Ar] 3d10 4s1", 1.9, "s"],
  [30, "Zn", "روی", "Zinc", "[Ar] 3d10 4s2", 1.65, "s"],
  [31, "Ga", "گالیم", "Gallium", "[Ar] 3d10 4s2 4p1", 1.81, "s", [3]],
  [32, "Ge", "ژرمانیم", "Germanium", "[Ar] 3d10 4s2 4p2", 2.01, "s"],
  [33, "As", "آرسنیک", "Arsenic", "[Ar] 3d10 4s2 4p3", 2.18, "s"],
  [34, "Se", "سلنیم", "Selenium", "[Ar] 3d10 4s2 4p4", 2.55, "s", [-2]],
  [35, "Br", "برم", "Bromine", "[Ar] 3d10 4s2 4p5", 2.96, "l", [-1]],
  [36, "Kr", "کریپتون", "Krypton", "[Ar] 3d10 4s2 4p6", 3.0, "g"],
  [37, "Rb", "روبیدیم", "Rubidium", "[Kr] 5s1", 0.82, "s", [1]],
  [38, "Sr", "استرانسیم", "Strontium", "[Kr] 5s2", 0.95, "s", [2]],
  [39, "Y", "ایتریم", "Yttrium", "[Kr] 4d1 5s2", 1.22, "s"],
  [40, "Zr", "زیرکونیم", "Zirconium", "[Kr] 4d2 5s2", 1.33, "s"],
  [41, "Nb", "نیوبیم", "Niobium", "[Kr] 4d4 5s1", 1.6, "s"],
  [42, "Mo", "مولیبدن", "Molybdenum", "[Kr] 4d5 5s1", 2.16, "s"],
  [43, "Tc", "تکنسیم", "Technetium", "[Kr] 4d5 5s2", 1.9, "s"],
  [44, "Ru", "روتنیم", "Ruthenium", "[Kr] 4d7 5s1", 2.2, "s"],
  [45, "Rh", "رودیم", "Rhodium", "[Kr] 4d8 5s1", 2.28, "s"],
  [46, "Pd", "پالادیم", "Palladium", "[Kr] 4d10", 2.2, "s"],
  [47, "Ag", "نقره", "Silver", "[Kr] 4d10 5s1", 1.93, "s"],
  [48, "Cd", "کادمیم", "Cadmium", "[Kr] 4d10 5s2", 1.69, "s"],
  [49, "In", "ایندیم", "Indium", "[Kr] 4d10 5s2 5p1", 1.78, "s", [3]],
  [50, "Sn", "قلع", "Tin", "[Kr] 4d10 5s2 5p2", 1.96, "s", [2, 4]],
  [51, "Sb", "آنتیموان", "Antimony", "[Kr] 4d10 5s2 5p3", 2.05, "s"],
  [52, "Te", "تلوریم", "Tellurium", "[Kr] 4d10 5s2 5p4", 2.1, "s", [-2]],
  [53, "I", "ید", "Iodine", "[Kr] 4d10 5s2 5p5", 2.66, "s", [-1]],
  [54, "Xe", "زنون", "Xenon", "[Kr] 4d10 5s2 5p6", 2.6, "g"],
  [55, "Cs", "سزیم", "Caesium", "[Xe] 6s1", 0.79, "s", [1]],
  [56, "Ba", "باریم", "Barium", "[Xe] 6s2", 0.89, "s", [2]],
  [57, "La", "لانتان", "Lanthanum", "[Xe] 5d1 6s2", 1.1, "s"],
  [58, "Ce", "سریم", "Cerium", "[Xe] 4f1 5d1 6s2", 1.12, "s"],
  [59, "Pr", "پرازئودیمیم", "Praseodymium", "[Xe] 4f3 6s2", 1.13, "s"],
  [60, "Nd", "نئودیمیم", "Neodymium", "[Xe] 4f4 6s2", 1.14, "s"],
  [61, "Pm", "پرومتیم", "Promethium", "[Xe] 4f5 6s2", 1.13, "s"],
  [62, "Sm", "ساماریم", "Samarium", "[Xe] 4f6 6s2", 1.17, "s"],
  [63, "Eu", "یوروپیم", "Europium", "[Xe] 4f7 6s2", 1.2, "s"],
  [64, "Gd", "گادولینیم", "Gadolinium", "[Xe] 4f7 5d1 6s2", 1.2, "s"],
  [65, "Tb", "تربیم", "Terbium", "[Xe] 4f9 6s2", 1.1, "s"],
  [66, "Dy", "دیسپروزیم", "Dysprosium", "[Xe] 4f10 6s2", 1.22, "s"],
  [67, "Ho", "هولمیم", "Holmium", "[Xe] 4f11 6s2", 1.23, "s"],
  [68, "Er", "اربیم", "Erbium", "[Xe] 4f12 6s2", 1.24, "s"],
  [69, "Tm", "تولیم", "Thulium", "[Xe] 4f13 6s2", 1.25, "s"],
  [70, "Yb", "ایتربیم", "Ytterbium", "[Xe] 4f14 6s2", 1.1, "s"],
  [71, "Lu", "لوتسیم", "Lutetium", "[Xe] 4f14 5d1 6s2", 1.27, "s"],
  [72, "Hf", "هافنیم", "Hafnium", "[Xe] 4f14 5d2 6s2", 1.3, "s"],
  [73, "Ta", "تانتال", "Tantalum", "[Xe] 4f14 5d3 6s2", 1.5, "s"],
  [74, "W", "تنگستن", "Tungsten", "[Xe] 4f14 5d4 6s2", 2.36, "s"],
  [75, "Re", "رنیم", "Rhenium", "[Xe] 4f14 5d5 6s2", 1.9, "s"],
  [76, "Os", "اسمیم", "Osmium", "[Xe] 4f14 5d6 6s2", 2.2, "s"],
  [77, "Ir", "ایریدیم", "Iridium", "[Xe] 4f14 5d7 6s2", 2.2, "s"],
  [78, "Pt", "پلاتین", "Platinum", "[Xe] 4f14 5d9 6s1", 2.28, "s"],
  [79, "Au", "طلا", "Gold", "[Xe] 4f14 5d10 6s1", 2.54, "s"],
  [80, "Hg", "جیوه", "Mercury", "[Xe] 4f14 5d10 6s2", 2.0, "l"],
  [81, "Tl", "تالیم", "Thallium", "[Xe] 4f14 5d10 6s2 6p1", 1.62, "s", [1, 3]],
  [82, "Pb", "سرب", "Lead", "[Xe] 4f14 5d10 6s2 6p2", 2.33, "s", [2, 4]],
  [83, "Bi", "بیسموت", "Bismuth", "[Xe] 4f14 5d10 6s2 6p3", 2.02, "s", [3]],
  [84, "Po", "پولونیم", "Polonium", "[Xe] 4f14 5d10 6s2 6p4", 2.0, "s"],
  [85, "At", "استاتین", "Astatine", "[Xe] 4f14 5d10 6s2 6p5", 2.2, "s"],
  [86, "Rn", "رادون", "Radon", "[Xe] 4f14 5d10 6s2 6p6", 2.2, "g"],
  [87, "Fr", "فرانسیم", "Francium", "[Rn] 7s1", 0.7, "s", [1]],
  [88, "Ra", "رادیم", "Radium", "[Rn] 7s2", 0.9, "s", [2]],
  [89, "Ac", "آکتینیم", "Actinium", "[Rn] 6d1 7s2", 1.1, "s"],
  [90, "Th", "توریم", "Thorium", "[Rn] 6d2 7s2", 1.3, "s"],
  [91, "Pa", "پروتاکتینیم", "Protactinium", "[Rn] 5f2 6d1 7s2", 1.5, "s"],
  [92, "U", "اورانیم", "Uranium", "[Rn] 5f3 6d1 7s2", 1.38, "s"],
  [93, "Np", "نپتونیم", "Neptunium", "[Rn] 5f4 6d1 7s2", 1.36, "s"],
  [94, "Pu", "پلوتونیم", "Plutonium", "[Rn] 5f6 7s2", 1.28, "s"],
  [95, "Am", "امریسیم", "Americium", "[Rn] 5f7 7s2", 1.3, "s"],
  [96, "Cm", "کوریم", "Curium", "[Rn] 5f7 6d1 7s2", 1.28, "s"],
  [97, "Bk", "برکلیم", "Berkelium", "[Rn] 5f9 7s2", 1.3, "s"],
  [98, "Cf", "کالیفرنیم", "Californium", "[Rn] 5f10 7s2", 1.3, "s"],
  [99, "Es", "اینشتینیم", "Einsteinium", "[Rn] 5f11 7s2", 1.3, "s"],
  [100, "Fm", "فرمیم", "Fermium", "[Rn] 5f12 7s2", 1.3, "u"],
  [101, "Md", "مندلیفیم", "Mendelevium", "[Rn] 5f13 7s2", 1.3, "u"],
  [102, "No", "نوبلیم", "Nobelium", "[Rn] 5f14 7s2", 1.3, "u"],
  [103, "Lr", "لارنسیم", "Lawrencium", "[Rn] 5f14 7s2 7p1", null, "u"],
  [104, "Rf", "رادرفوردیم", "Rutherfordium", "[Rn] 5f14 6d2 7s2", null, "u"],
  [105, "Db", "دوبنیم", "Dubnium", "[Rn] 5f14 6d3 7s2", null, "u"],
  [106, "Sg", "سیبورگیم", "Seaborgium", "[Rn] 5f14 6d4 7s2", null, "u"],
  [107, "Bh", "بوهریم", "Bohrium", "[Rn] 5f14 6d5 7s2", null, "u"],
  [108, "Hs", "هاسیم", "Hassium", "[Rn] 5f14 6d6 7s2", null, "u"],
  [109, "Mt", "مایتنریم", "Meitnerium", "[Rn] 5f14 6d7 7s2", null, "u"],
  [110, "Ds", "دارمشتادتیم", "Darmstadtium", "[Rn] 5f14 6d8 7s2", null, "u"],
  [111, "Rg", "رونتگنیم", "Roentgenium", "[Rn] 5f14 6d9 7s2", null, "u"],
  [112, "Cn", "کوپرنیسیم", "Copernicium", "[Rn] 5f14 6d10 7s2", null, "u"],
  [113, "Nh", "نیهونیم", "Nihonium", "[Rn] 5f14 6d10 7s2 7p1", null, "u"],
  [114, "Fl", "فلروویم", "Flerovium", "[Rn] 5f14 6d10 7s2 7p2", null, "u"],
  [115, "Mc", "مسکوویم", "Moscovium", "[Rn] 5f14 6d10 7s2 7p3", null, "u"],
  [116, "Lv", "لیورموریم", "Livermorium", "[Rn] 5f14 6d10 7s2 7p4", null, "u"],
  [117, "Ts", "تنسین", "Tennessine", "[Rn] 5f14 6d10 7s2 7p5", null, "u"],
  [118, "Og", "اوگانسون", "Oganesson", "[Rn] 5f14 6d10 7s2 7p6", null, "u"],
];

const CAT_SETS: [Category, string][] = [
  ["alkali", "Li Na K Rb Cs Fr"],
  ["alkaline-earth", "Be Mg Ca Sr Ba Ra"],
  ["post-transition", "Al Ga In Sn Tl Pb Bi Po Nh Fl Mc Lv"],
  ["metalloid", "B Si Ge As Sb Te"],
  ["nonmetal", "H C N O P S Se"],
  ["halogen", "F Cl Br I At Ts"],
  ["noble-gas", "He Ne Ar Kr Xe Rn Og"],
];
const CAT_OF = new Map<string, Category>(CAT_SETS.flatMap(([c, list]) => list.split(" ").map((s) => [s, c] as [string, Category])));

/** دوره از روی عدد اتمی */
export function periodOf(z: number): number {
  return z <= 2 ? 1 : z <= 10 ? 2 : z <= 18 ? 3 : z <= 36 ? 4 : z <= 54 ? 5 : z <= 86 ? 6 : 7;
}

/** گروه از روی عدد اتمی (null برای ۵۷–۷۱ و ۸۹–۱۰۳) */
export function groupOf(z: number): number | null {
  const p = periodOf(z);
  if (p === 1) return z === 1 ? 1 : 18;
  if (p === 2 || p === 3) {
    const i = z - (p === 2 ? 3 : 11);
    return i < 2 ? i + 1 : i + 11;
  }
  if (p === 4 || p === 5) return z - (p === 4 ? 18 : 36);
  const start = p === 6 ? 55 : 87;
  const i = z - start;
  if (i < 2) return i + 1;
  if (i <= 16) return null;
  return i - 13;
}

function blockOf(z: number, group: number | null): Block {
  if (group === null) return "f";
  if (z === 2 || group <= 2) return "s";
  if (group >= 13) return "p";
  return "d";
}

function categoryOf(z: number, symbol: string, group: number | null): Category {
  if (z >= 57 && z <= 71) return "lanthanide";
  if (z >= 89 && z <= 103) return "actinide";
  const c = CAT_OF.get(symbol);
  if (c) return c;
  if (group !== null && group >= 3 && group <= 12) return "transition";
  throw new Error(`دسته‌ی ${symbol} تعریف نشده`);
}

const PHASE: Record<PhaseCode, PhaseAt25> = { s: "solid", l: "liquid", g: "gas", u: "unknown" };

/** همه‌ی ۱۱۸ عنصر به ترتیب عدد اتمی */
export const ELEMENTS: readonly ChemElement[] = ROWS.map(([z, symbol, fa, en, config, electronegativity, ph, ions]) => {
  const group = groupOf(z);
  const massNumberOnly = MASS_NUMBER_ONLY.has(symbol);
  const mass = ATOMIC_MASS[symbol];
  return {
    z,
    symbol,
    fa,
    en,
    mass,
    massText: massNumberOnly ? `[${mass}]` : String(mass),
    massNumberOnly,
    radioactive: z === 43 || z === 61 || z >= 84,
    period: periodOf(z),
    group,
    block: blockOf(z, group),
    category: categoryOf(z, symbol, group),
    config,
    predicted: z >= 104,
    electronegativity,
    phase: PHASE[ph],
    ions: ions ?? [],
  };
});

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));

/** عنصر با نماد (حساس به حروف بزرگ و کوچک) */
export const elementBySymbol = (symbol: string) => BY_SYMBOL.get(symbol);
/** عنصر با عدد اتمی */
export const elementByZ = (z: number) => ELEMENTS[z - 1];

/** یکسان‌سازی متن فارسی برای جست‌وجو (ی و ک عربی، نیم‌فاصله، اعراب) */
const faKey = (s: string) =>
  s
    .replace(/\u064a/g, "ی")
    .replace(/\u0643/g, "ک")
    .replace(/[‌‏ً-ْ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

/** جست‌وجوی عنصر با نماد، نام فارسی یا نام انگلیسی یا عدد اتمی */
export function findElement(q: string): ChemElement | undefined {
  const t = q.trim();
  if (!t) return undefined;
  const bySym = BY_SYMBOL.get(t) ?? ELEMENTS.find((e) => e.symbol.toLowerCase() === t.toLowerCase());
  if (bySym) return bySym;
  const digits = t.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  if (/^\d+$/.test(digits)) return elementByZ(Number(digits));
  const k = faKey(t);
  return ELEMENTS.find((e) => faKey(e.fa) === k || e.en.toLowerCase() === k);
}

/** الکترون‌های ظرفیت عنصرهای اصلی (گروه ۱، ۲ و ۱۳ تا ۱۸)؛ برای بقیه null */
export function valenceElectrons(e: ChemElement): number | null {
  if (e.symbol === "He") return 2;
  if (e.group === null || (e.group > 2 && e.group < 13)) return null;
  return e.group <= 2 ? e.group : e.group - 10;
}

export interface Subshell {
  n: number;
  l: "s" | "p" | "d" | "f";
  e: number;
}

const L_ORDER = { s: 0, p: 1, d: 2, f: 3 } as const;
const L_MAX = { s: 2, p: 6, d: 10, f: 14 } as const;
const NOBLE_CORE: Record<string, number> = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };

/** بخش‌های آرایش فشرده: هسته‌ی گاز نجیب و زیرلایه‌ها */
export function configParts(config: string): { core?: string; subshells: Subshell[] } {
  const m = /^\[(\w+)\]\s*/.exec(config);
  const rest = m ? config.slice(m[0].length) : config;
  const subshells = rest
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const mm = /^(\d)([spdf])(\d+)$/.exec(t);
      if (!mm) throw new Error(`زیرلایه‌ی نامعتبر: ${t}`);
      return { n: Number(mm[1]), l: mm[2] as Subshell["l"], e: Number(mm[3]) };
    });
  return { core: m?.[1], subshells };
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** متن ساده با بالانویس یونیکد: «[Ar] 3d⁶ 4s²» (برای عنوان، متا و aria) */
export const configPlain = (config: string) => config.replace(/([spdf])(\d+)/g, (_, l: string, d: string) => l + d.replace(/\d/g, (x) => SUP[Number(x)]));

const sortShells = (a: Subshell, b: Subshell) => a.n - b.n || L_ORDER[a.l] - L_ORDER[b.l];

/** ترتیب پرشدن زیرلایه‌ها (قاعده‌ی آفبا، n + l) */
export const AUFBAU_ORDER: [number, Subshell["l"]][] = [
  [1, "s"], [2, "s"], [2, "p"], [3, "s"], [3, "p"], [4, "s"], [3, "d"], [4, "p"], [5, "s"], [4, "d"], [5, "p"], [6, "s"],
  [4, "f"], [5, "d"], [6, "p"], [7, "s"], [5, "f"], [6, "d"], [7, "p"],
];

/** آرایش طبق قاعده‌ی آفبا بدون استثنا (برای آموزش و آزمون؛ برای Cr و Cu با آرایش واقعی فرق دارد) */
export function aufbauSubshells(z: number): Subshell[] {
  let left = z;
  const out: Subshell[] = [];
  for (const [n, l] of AUFBAU_ORDER) {
    if (left <= 0) break;
    const e = Math.min(left, L_MAX[l]);
    out.push({ n, l, e });
    left -= e;
  }
  return out;
}

/** زیرلایه‌های کامل (گسترده) یک عنصر از روی آرایش فشرده‌ی واقعی، به ترتیب n */
export function fullSubshells(e: ChemElement | number): Subshell[] {
  const el = typeof e === "number" ? elementByZ(e) : e;
  const { core, subshells } = configParts(el.config);
  if (core && !NOBLE_CORE[core]) throw new Error(`هسته‌ی گاز نجیب نامعتبر: ${core}`);
  const coreShells = core ? fullSubshells(BY_SYMBOL.get(core)!) : [];
  return [...coreShells, ...subshells].sort(sortShells);
}

const shellsText = (s: Subshell[]) => s.map((x) => `${x.n}${x.l}${x.e}`).join(" ");

/**
 * آرایش گسترده، مثل «1s2 2s2 2p6 3s2 3p6 3d6 4s2».
 * order = "n": به ترتیب لایه‌ها (پیش‌فرض)؛ order = "aufbau": به ترتیب پرشدن (4s پیش از 3d) با همان تعداد الکترون‌ها.
 */
export function fullConfig(e: ChemElement | number, order: "n" | "aufbau" = "n"): string {
  const shells = fullSubshells(e);
  if (order === "n") return shellsText(shells);
  const idx = (s: Subshell) => AUFBAU_ORDER.findIndex(([n, l]) => n === s.n && l === s.l);
  return shellsText([...shells].sort((a, b) => idx(a) - idx(b)));
}

/** مجموع الکترون‌های یک آرایش (برای آزمون درستی داده) */
export const electronCount = (e: ChemElement) => fullSubshells(e).reduce((a, s) => a + s.e, 0);
