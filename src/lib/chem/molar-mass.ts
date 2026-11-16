/**
 * جرم مولی، تبدیل گرم ↔ مول ↔ ذره و جرم اتمی میانگین (خالص و ایزومورفیک).
 * فقط به masses.ts وابسته است (نه elements.ts) تا بسته‌ی کلاینت ابزار جرم مولی کوچک بماند.
 */
import { ChemError, faDigits, fail, fixed, fmtVal, roundTo, sciMath, toFail, trimNum, type ChemFail, type ChemStep } from "./common";
import { parseFormula, type ParsedFormula } from "./formula";
import { ATOMIC_MASS, decimalsOf, EXAM_MASSES, MASS_NUMBER_ONLY } from "./masses";
import { parseNumberInput } from "./normalize";

/** «precise»: جرم اتمی استاندارد IUPAC؛ «exam»: جرم‌های گردشده‌ی رایج در مسئله‌های درسی */
export type MassMode = "precise" | "exam";

export interface MassRow {
  symbol: string;
  count: number;
  /** جرم اتمی به‌کاررفته (g/mol) */
  mass: number;
  /** count × mass */
  subtotal: number;
  /** precise | exam | fallback (حالت امتحانی بدون مقدار گردشده → جرم دقیق) */
  source: "precise" | "exam" | "fallback";
  /** جرم استاندارد ندارد و عدد جرمی پایدارترین ایزوتوپ است */
  massNumberOnly: boolean;
}

export interface MolarMassOk {
  ok: true;
  formula: ParsedFormula;
  mode: MassMode;
  rows: MassRow[];
  /** مجموع خام (۶ رقم اعشار) */
  total: number;
  /** تعداد رقم اعشار گزارش (قاعده‌ی جمع: کمترین رقم اعشار جرم‌ها، حداکثر ۳) */
  decimals: number;
  /** مجموع گردشده برای گزارش */
  value: number;
  /** متن گزارش با رقم لاتین، مثل «18.015» */
  valueText: string;
  steps: ChemStep[];
  warnings: string[];
}

export type MolarMassResult = MolarMassOk | ChemFail;

/** جرم اتمی یک عنصر در حالت داده‌شده */
function massFor(symbol: string, mode: MassMode): { mass: number; source: MassRow["source"] } {
  if (mode === "exam") {
    const m = EXAM_MASSES[symbol];
    if (m !== undefined) return { mass: m, source: "exam" };
    return { mass: ATOMIC_MASS[symbol], source: "fallback" };
  }
  return { mass: ATOMIC_MASS[symbol], source: "precise" };
}

/**
 * جرم مولی یک فرمول با جدول مرحله‌به‌مرحله.
 * مثال: molarMass("CuSO4·5H2O") → 249.68 ؛ molarMass("H2SO4", { mode: "exam" }) → 98
 */
export function molarMass(input: string, opts: { mode?: MassMode } = {}): MolarMassResult {
  const mode = opts.mode ?? "precise";
  let f: ParsedFormula;
  try {
    f = parseFormula(input);
  } catch (e) {
    return toFail(e);
  }
  if (f.isElectron) return fail("الکترون جرم مولی قابل‌توجهی ندارد؛ یک فرمول وارد کنید.", "electron");

  const warnings = [...f.warnings];
  const rows: MassRow[] = Object.entries(f.counts).map(([symbol, count]) => {
    const { mass, source } = massFor(symbol, mode);
    return { symbol, count, mass, subtotal: count * mass, source, massNumberOnly: MASS_NUMBER_ONLY.has(symbol) };
  });
  const sum = rows.reduce((a, r) => a + r.subtotal, 0);

  const decimals =
    mode === "exam"
      ? Math.max(0, ...rows.map((r) => (r.source === "exam" ? decimalsOf(r.mass) : Math.min(3, decimalsOf(r.mass)))))
      : Math.min(3, ...rows.map((r) => decimalsOf(r.mass)));
  const value = roundTo(sum, decimals);
  const valueText = fixed(sum, decimals);

  if (f.coefficient !== 1)
    warnings.push(`ضریب ${faDigits(f.coefficient)} نادیده گرفته شد؛ جرم مولی برای یک مول {{${f.body}}} حساب شده است.`);
  if (f.charge !== 0) warnings.push("جرم الکترون‌های گرفته‌شده یا از دست‌رفته بسیار ناچیز است و در جرم مولی یون حساب نمی‌شود.");
  for (const r of rows) {
    if (r.massNumberOnly)
      warnings.push(
        `عنصر {{${r.symbol}}} جرم اتمی استاندارد ندارد؛ عدد جرمی پایدارترین ایزوتوپ آن (${faDigits(r.mass)}) به کار رفت.`,
      );
    if (r.source === "fallback")
      warnings.push(`برای {{${r.symbol}}} جرم گردشده‌ی رایجی تعریف نشده و جرم دقیق (${faDigits(r.mass)}) به کار رفت.`);
  }

  const hydrate = f.parts.length > 1;
  const steps: ChemStep[] = [
    {
      title: "شمارش اتم‌ها",
      text:
        "تعداد اتم‌های هر عنصر را از روی زیروندها می‌شماریم؛ زیروندِ بیرون پرانتز در تعداد همه‌ی اتم‌های داخل آن ضرب می‌شود." +
        (hydrate
          ? ` مولکول‌های آب تبلور هم بخشی از فرمول‌اند و باید شمرده شوند (${f.parts
              .slice(1)
              .map((p) => `${faDigits(p.multiplier)} واحد {{${p.text}}}`)
              .join(" و ")}).`
          : ""),
      math: rows.map((r) => `{{${r.symbol}}}: ${r.count}`),
    },
    {
      title: "ضرب تعداد در جرم مولی عنصر",
      text:
        mode === "exam"
          ? "تعداد اتم هر عنصر را در جرم مولی گردشده‌ی آن عنصر (گرم بر مول) ضرب می‌کنیم."
          : "تعداد اتم هر عنصر را در جرم مولی آن عنصر ضرب می‌کنیم؛ این عدد با جرم اتمی میانگین برابر است و یکای آن گرم بر مول است.",
      math: rows.map((r) => `{{${r.symbol}}}: ${r.count} × ${trimNum(r.mass, 10)} = ${trimNum(r.subtotal, 8)}`),
    },
    {
      title: "جمع سهم عنصرها",
      text: `جرم مولی {{${f.body}}} برابر است با مجموع سهم عنصرها: **${faDigits(valueText)} گرم بر مول**.`,
      math: [`M = ${rows.map((r) => trimNum(r.subtotal, 8)).join(" + ")} ≈ ${valueText} g/mol`],
    },
  ];

  return { ok: true, formula: f, mode, rows, total: roundTo(sum, 6), decimals, value, valueText, steps, warnings };
}

/** جرم مولی عددی (برای جدول‌های ساخته‌شده در زمان build)؛ خطای ورودی را پرتاب می‌کند */
export function massOf(formula: string, mode: MassMode = "precise"): number {
  const r = molarMass(formula, { mode });
  if (!r.ok) throw new ChemError(r.error, r.code);
  return r.value;
}

/** عدد آووگادرو: مقدار دقیق SI و مقدار گردشده‌ی کتاب درسی */
export const AVOGADRO = 6.02214076e23;
export const AVOGADRO_TEXTBOOK = 6.02e23;

export type AmountUnit = "g" | "mol" | "particles";

export interface AmountOk {
  ok: true;
  grams: number;
  moles: number;
  particles: number;
  steps: ChemStep[];
  warnings: string[];
}

/**
 * تبدیل گرم ↔ مول ↔ تعداد ذره به روش «کسر تبدیل».
 * n = m / M و N = n × NA (پیش‌فرض NA = 6.02×10^23 مثل کتاب درسی)
 */
export function convertAmount(o: {
  value: number | string;
  from: AmountUnit;
  molarMass: number;
  /** فرمول برای نوشتن واحدها، مثل «H2O» */
  formula?: string;
  avogadro?: number;
  /** نام ذره در متن: «مولکول»، «اتم»، «یون»، «واحد فرمولی» */
  particle?: string;
}): AmountOk | ChemFail {
  const v = parseNumberInput(o.value);
  if (v === null || v <= 0) return fail("مقدار باید عددی مثبت باشد.", "value");
  if (!(o.molarMass > 0)) return fail("جرم مولی معتبر نیست.", "molar-mass");
  const NA = o.avogadro ?? AVOGADRO_TEXTBOOK;
  const M = o.molarMass;
  const sp = o.formula ? ` {{${o.formula}}}` : "";
  const part = o.particle ?? "ذره";
  const NAtxt = sciMath(NA, NA === AVOGADRO_TEXTBOOK ? 3 : 9, true);

  let grams: number, moles: number, particles: number;
  const steps: ChemStep[] = [];
  const toMolFromG = () =>
    steps.push({
      title: "گرم به مول",
      text: "جرم را در کسر تبدیلی ضرب می‌کنیم که «مول» در صورت و «گرم» در مخرج آن است تا واحد گرم حذف شود.",
      math: [`n = ${fmtVal(grams)} g${sp} × (1 mol${sp} / ${trimNum(M, 6)} g${sp}) = ${fmtVal(moles)} mol${sp}`],
    });
  const toNFromMol = () =>
    steps.push({
      title: "مول به تعداد ذره",
      text: "یک مول از هر ماده حدود {{6.02×10^23}} ذره (عدد آووگادرو) دارد؛ پس مقدار مول را در کسر تبدیل عدد آووگادرو ضرب می‌کنیم.",
      math: [`N = ${fmtVal(moles)} mol × (${NAtxt} ${part} / 1 mol) = ${sciMath(particles, 3, true)} ${part}`],
    });

  if (o.from === "g") {
    grams = v;
    moles = v / M;
    particles = moles * NA;
    toMolFromG();
    toNFromMol();
  } else if (o.from === "mol") {
    moles = v;
    grams = v * M;
    particles = v * NA;
    steps.push({
      title: "مول به گرم",
      text: "مقدار مول را در کسر تبدیلی ضرب می‌کنیم که «گرم» در صورت و «مول» در مخرج آن است.",
      math: [`m = ${fmtVal(moles)} mol${sp} × (${trimNum(M, 6)} g${sp} / 1 mol${sp}) = ${fmtVal(grams)} g${sp}`],
    });
    toNFromMol();
  } else {
    particles = v;
    moles = v / NA;
    grams = moles * M;
    steps.push({
      title: "تعداد ذره به مول",
      text: "تعداد ذره را در کسر تبدیلی ضرب می‌کنیم که «مول» در صورت و عدد آووگادرو در مخرج آن است.",
      math: [`n = ${sciMath(particles, 3, true)} ${part} × (1 mol / ${NAtxt} ${part}) = ${fmtVal(moles)} mol`],
    });
    steps.push({
      title: "مول به گرم",
      text: "سپس مقدار مول را در جرم مولی ضرب می‌کنیم.",
      math: [`m = ${fmtVal(moles)} mol × (${trimNum(M, 6)} g / 1 mol) = ${fmtVal(grams)} g`],
    });
  }
  return { ok: true, grams, moles, particles, steps, warnings: [] };
}

export interface Isotope {
  /** جرم (یا عدد جرمی در مسئله‌های درسی) */
  mass: number | string;
  /** درصد فراوانی */
  abundance: number | string;
  /** برچسب به نحو Chem، مثل «^{35}Cl» */
  label?: string;
}

/** نمونه‌ی پیش‌فرض: کلر با دو ایزوتوپ ۳۵ و ۳۷ (۷۵٪ و ۲۵٪) → ۳۵٫۵ */
export const DEFAULT_ISOTOPES: Isotope[] = [
  { label: "^{35}Cl", mass: 35, abundance: 75 },
  { label: "^{37}Cl", mass: 37, abundance: 25 },
];

export interface AverageMassOk {
  ok: true;
  average: number;
  abundanceSum: number;
  steps: ChemStep[];
  warnings: string[];
}

/** جرم اتمی میانگین: M = Σ(جرم × فراوانی) / Σ فراوانی */
export function averageAtomicMass(isotopes: Isotope[]): AverageMassOk | ChemFail {
  if (isotopes.length < 1) return fail("دست‌کم یک ایزوتوپ وارد کنید.", "empty");
  const rows: { m: number; a: number; label?: string }[] = [];
  for (const iso of isotopes) {
    const m = parseNumberInput(iso.mass);
    const a = parseNumberInput(iso.abundance);
    if (m === null || m <= 0) return fail("جرم هر ایزوتوپ باید عددی مثبت باشد.", "mass");
    if (a === null || a < 0 || a > 100) return fail("درصد فراوانی باید عددی بین ۰ تا ۱۰۰ باشد.", "abundance");
    rows.push({ m, a, label: iso.label });
  }
  const sumA = rows.reduce((s, r) => s + r.a, 0);
  if (sumA <= 0) return fail("مجموع درصد فراوانی‌ها صفر است.", "abundance");
  const warnings: string[] = [];
  if (Math.abs(sumA - 100) > 0.05) {
    if (sumA > 100.05) return fail(`مجموع درصد فراوانی‌ها (${faDigits(trimNum(sumA, 3))}) بیشتر از ۱۰۰ است.`, "abundance");
    warnings.push(`مجموع درصد فراوانی‌ها ${faDigits(trimNum(sumA, 3))} است، نه ۱۰۰؛ میانگین بر پایه‌ی همین مجموع حساب شد.`);
  }
  const weighted = rows.reduce((s, r) => s + r.m * r.a, 0);
  const average = weighted / sumA;
  const steps: ChemStep[] = [
    {
      title: "میانگین وزنی",
      text: "جرم هر ایزوتوپ را در درصد فراوانی‌اش ضرب می‌کنیم، حاصل‌ها را جمع می‌زنیم و بر مجموع درصدها تقسیم می‌کنیم.",
      math: [
        `M = (${rows.map((r) => `${trimNum(r.m, 6)} × ${trimNum(r.a, 4)}`).join(" + ")}) / ${trimNum(sumA, 4)}`,
        `M = ${trimNum(weighted, 6)} / ${trimNum(sumA, 4)} = ${trimNum(average, 4)}`,
      ],
    },
  ];
  return { ok: true, average: roundTo(average, 6), abundanceSum: sumA, steps, warnings };
}
