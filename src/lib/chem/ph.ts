/**
 * محاسبه‌ی pH در دمای ۲۵ درجه‌ی سلسیوس (خالص و ایزومورفیک).
 *
 * - اسید/باز قوی با ضریب استوکیومتری (مثلاً ۲ برای Ba(OH)2)
 * - اسید/باز ضعیف با Ka/Kb: روش تقریبی √(Ka·C) با درصد یونش و شرط ۵٪، و جواب دقیق معادله‌ی درجه دوم
 * - تبدیل pH ↔ pOH ↔ [H+] ↔ [OH-] و رقیق‌سازی (C1V1 = C2V2)
 * همه‌ی محاسبه‌ها Kw = 1.0×10^-14 (دمای ۲۵ درجه) را فرض می‌کنند.
 */
import { concMath, faDigits, fail, fixed, fmtVal, sciMath, trimNum, type ChemFail, type ChemStep } from "./common";
import { parseNumberInput } from "./normalize";

/** ثابت یونش آب در ۲۵ درجه */
export const KW = 1.0e-14;
export const PKW = 14;
/** زیر این غلظت سهم یونش آب ناچیز نیست */
export const LOW_CONC = 1e-6;
/** مرز اعتبار تقریب اسید/باز ضعیف (درصد یونش) */
export const APPROX_LIMIT = 0.05;

export type PhKind = "strong-acid" | "strong-base" | "weak-acid" | "weak-base" | "convert";

export interface PhValues {
  pH: number;
  pOH: number;
  /** [H+] بر حسب mol/L */
  H: number;
  /** [OH-] بر حسب mol/L */
  OH: number;
}

export interface WeakDetail {
  /** روش تقریبی کتاب درسی: x = √(K·C) */
  approx: PhValues & { x: number; alpha: number };
  /** جواب دقیق معادله‌ی درجه دوم */
  exact: PhValues & { x: number; alpha: number };
  /** درصد یونش تقریبی ≤ ۵٪ */
  approxValid: boolean;
}

export interface PhOk extends PhValues {
  ok: true;
  kind: PhKind;
  /** اسیدی، خنثی یا بازی در ۲۵ درجه */
  nature: "acidic" | "neutral" | "basic";
  /** برای اسید/باز ضعیف: هر دو روش (مقدارهای اصلی همان جواب دقیق‌اند) */
  weak?: WeakDetail;
  steps: ChemStep[];
  warnings: string[];
}

export type PhResult = PhOk | ChemFail;

const log10 = (x: number) => Math.log10(x);
const p2 = (x: number) => fixed(x, 2);
const H_ = "{{[H^+]}}";
const OH_ = "{{[OH^-]}}";
const KW_ = "{{K_w}}";

/** pH از [H+] و بقیه‌ی مقدارها */
export function valuesFromH(H: number): PhValues {
  const pH = -log10(H);
  return { pH, pOH: PKW - pH, H, OH: KW / H };
}

/** pH از [OH-] و بقیه‌ی مقدارها */
export function valuesFromOH(OH: number): PhValues {
  const pOH = -log10(OH);
  return { pH: PKW - pOH, pOH, H: KW / OH, OH };
}

const natureOf = (pH: number): PhOk["nature"] => (Math.abs(pH - 7) < 0.005 ? "neutral" : pH < 7 ? "acidic" : "basic");

const NATURE_FA = { acidic: "اسیدی", neutral: "خنثی", basic: "بازی" } as const;

function ok(kind: PhKind, v: PhValues, steps: ChemStep[], warnings: string[], weak?: WeakDetail): PhOk {
  const nature = natureOf(v.pH);
  steps.push({
    title: "نتیجه",
    text: `در دمای ۲۵ درجه‌ی سلسیوس محلول **${NATURE_FA[nature]}** است (pH ${nature === "acidic" ? "کمتر از" : nature === "basic" ? "بیشتر از" : "برابر"} ۷).`,
  });
  return { ok: true, kind, ...v, nature, weak, steps, warnings };
}

function readConc(c: number | string, what = "غلظت"): number | ChemFail {
  const v = parseNumberInput(c);
  if (v === null || !(v > 0)) return fail(`${what} باید عددی مثبت باشد.`, "value");
  if (v > 20) return fail(`${what} بیش از اندازه بزرگ است (بیشتر از ۲۰ مول بر لیتر).`, "value");
  return v;
}

function readFactor(n: number | string | undefined): number | ChemFail {
  const v = n === undefined ? 1 : parseNumberInput(n);
  if (v === null || !Number.isInteger(v) || v < 1 || v > 4) return fail("تعداد یون‌های {{H^+}} یا {{OH^-}} هر واحد باید عدد صحیح ۱ تا ۴ باشد.", "factor");
  return v;
}

/** ثابت تعادل با کمترین رقم لازم: «1.8×{{10^-5}}» */
const kText = (K: number) => sciMath(K, 4, true).replace(/(\.\d*?)0+×/, "$1×").replace(/\.×/, "×");

const isFail = (x: unknown): x is ChemFail => typeof x === "object" && x !== null && (x as ChemFail).ok === false;

/** هشدار قرارداد سولفوریک اسید */
const H2SO4_NOTE =
  "برای {{H2SO4}} قرارداد رایج در مسئله‌ها شمردن دو یون {{H^+}} برای هر مولکول است، در حالی که مرحله‌ی دوم یونش آن کامل نیست؛ این قرارداد باید با کتاب درسی و استاد تطبیق داده شود.";

/** اسید یا باز قوی */
function strong(base: boolean, o: { c: number | string; n?: number | string; formula?: string }): PhResult {
  const c = readConc(o.c);
  if (isFail(c)) return c;
  const n = readFactor(o.n);
  if (isFail(n)) return n;
  const warnings: string[] = [];
  const ion = base ? OH_ : H_;
  const ionName = base ? "{{OH^-}}" : "{{H^+}}";
  const sp = o.formula ? `{{${o.formula}}}` : base ? "باز قوی" : "اسید قوی";
  const conc = n * c;

  if (!base && o.formula && o.formula.replace(/\s/g, "") === "H2SO4") warnings.push(H2SO4_NOTE);

  const steps: ChemStep[] = [
    {
      title: base ? "تفکیک کامل" : "یونش کامل",
      text: base
        ? `${sp} بازی قوی است و در آب به‌طور کامل به یون‌های سازنده‌اش تفکیک می‌شود؛ هر مول آن ${faDigits(n)} مول یون ${ionName} می‌دهد.`
        : `${sp} اسیدی قوی است و در آب به‌طور کامل یونیده می‌شود؛ هر مول آن ${faDigits(n)} مول یون ${ionName} می‌دهد.`,
      math: [`${ion} = ${n} × ${fmtVal(c)} = ${fmtVal(conc)} mol/L`],
    },
  ];

  let v: PhValues;
  if (conc < LOW_CONC) {
    // سهم یونش آب: [ion]² − C·[ion] − Kw = 0
    const x = (conc + Math.sqrt(conc * conc + 4 * KW)) / 2;
    v = base ? valuesFromOH(x) : valuesFromH(x);
    const naive = base ? PKW + log10(conc) : -log10(conc);
    warnings.push(
      `غلظت ${ionName} حاصل از ${base ? "باز" : "اسید"} کمتر از {{10^-6}} مول بر لیتر است؛ در این حالت یون‌های حاصل از یونش آب ناچیز نیستند و pH با در نظر گرفتن یونش آب حساب شد (روش ساده pH را ${faDigits(p2(naive))} می‌داد).`,
    );
    steps.push({
      title: "در نظر گرفتن یونش آب",
      text: "چون غلظت بسیار کم است، یون‌های حاصل از یونش آب را هم حساب می‌کنیم.",
      math: [`x² − ${fmtVal(conc)}·x − ${KW_} = 0`, `x = ${fmtVal(x)} mol/L`],
    });
  } else {
    v = base ? valuesFromOH(conc) : valuesFromH(conc);
  }

  if (base) {
    steps.push(
      {
        title: "محاسبه‌ی pOH",
        math: [`pOH = −log${OH_} = −log(${concMath(v.OH)}) = ${p2(v.pOH)}`],
      },
      {
        title: "محاسبه‌ی pH",
        text: "در دمای ۲۵ درجه مجموع pH و pOH برابر ۱۴ است.",
        math: [`pH = 14 − pOH = 14 − ${p2(v.pOH)} = ${p2(v.pH)}`, `${H_} = ${KW_} / ${OH_} = ${concMath(v.H)} mol/L`],
      },
    );
  } else {
    steps.push(
      {
        title: "محاسبه‌ی pH",
        math: [`pH = −log${H_} = −log(${concMath(v.H)}) = ${p2(v.pH)}`],
      },
      {
        title: "محاسبه‌ی pOH و غلظت یون هیدروکسید",
        text: "در دمای ۲۵ درجه مجموع pH و pOH برابر ۱۴ است.",
        math: [`pOH = 14 − ${p2(v.pH)} = ${p2(v.pOH)}`, `${OH_} = ${KW_} / ${H_} = ${concMath(v.OH)} mol/L`],
      },
    );
  }
  return ok(base ? "strong-base" : "strong-acid", v, steps, warnings);
}

/** اسید قوی: [H+] = n·C */
export const strongAcid = (o: { c: number | string; n?: number | string; formula?: string }) => strong(false, o);
/** باز قوی: [OH-] = n·C (مثلاً n = 2 برای Ba(OH)2) */
export const strongBase = (o: { c: number | string; n?: number | string; formula?: string }) => strong(true, o);

/** اسید یا باز ضعیف */
function weak(base: boolean, o: { c: number | string; k: number | string; formula?: string }): PhResult {
  const c = readConc(o.c);
  if (isFail(c)) return c;
  const K = parseNumberInput(o.k);
  const kName = base ? "{{K_b}}" : "{{K_a}}";
  const kPlain = base ? "Kb" : "Ka";
  if (K === null || !(K > 0)) return fail(`${kPlain} باید عددی مثبت باشد.`, "k");
  const warnings: string[] = [];
  if (K >= 1) warnings.push(`${kName} بزرگ‌تر از ۱ یعنی ${base ? "باز" : "اسید"} عملاً قوی است؛ بهتر است از حالت «قوی» استفاده کنید.`);
  if (c < LOW_CONC) warnings.push("غلظت بسیار کم است و سهم یونش آب در این محاسبه در نظر گرفته نشده است.");

  const ionName = base ? "{{OH^-}}" : "{{H^+}}";
  const ion = base ? OH_ : H_;
  const sp = o.formula ? `{{${o.formula}}}` : base ? "باز ضعیف" : "اسید ضعیف";
  const fromX = (x: number) => (base ? valuesFromOH(x) : valuesFromH(x));

  const xa = Math.sqrt(K * c);
  const xe = (-K + Math.sqrt(K * K + 4 * K * c)) / 2;
  const approx = { ...fromX(xa), x: xa, alpha: xa / c };
  const exact = { ...fromX(xe), x: xe, alpha: xe / c };
  const approxValid = approx.alpha <= APPROX_LIMIT;
  const pct = (a: number) => trimNum(a * 100, 2);
  const pName = base ? "pOH" : "pH";
  const pOf = (v: PhValues) => (base ? v.pOH : v.pH);

  const steps: ChemStep[] = [
    {
      title: "تعادل یونش",
      text: `${sp} ${base ? "بازی ضعیف" : "اسیدی ضعیف"} است و فقط بخش کوچکی از آن یونیده می‌شود. اگر غلظت ${ionName} در تعادل x باشد:`,
      math: [`${kName} = x² / (C − x)`, `C = ${fmtVal(c)} mol/L , ${kName} = ${kText(K)}`],
    },
    {
      title: "روش تقریبی",
      text: "چون یونش کم است، x در برابر C ناچیز فرض می‌شود (C − x ≈ C):",
      math: [
        `x = √(${kName} × C) = √(${kText(K)} × ${fmtVal(c)}) = ${concMath(xa)} mol/L`,
        `${pName} = −log(${concMath(xa)}) = ${p2(pOf(approx))}`,
        `α = x / C = ${concMath(xa)} / ${fmtVal(c)} = ${fmtVal(approx.alpha, 3)} (${pct(approx.alpha)}%)`,
      ],
    },
    {
      title: "اعتبار تقریب",
      text: approxValid
        ? `درصد یونش ${faDigits(pct(approx.alpha))}٪ و کمتر از ۵٪ است، پس تقریب قابل قبول است.`
        : `درصد یونش ${faDigits(pct(approx.alpha))}٪ و بیشتر از ۵٪ است، پس تقریب قابل قبول نیست و باید از جواب دقیق استفاده کرد.`,
    },
    {
      title: "جواب دقیق (معادله‌ی درجه دوم)",
      math: [
        `x² + ${kName}·x − ${kName}·C = 0`,
        `x = (−${kName} + √(${kName}² + 4·${kName}·C)) / 2 = ${concMath(xe)} mol/L`,
        `${pName} = −log(${concMath(xe)}) = ${p2(pOf(exact))}`,
        `α = ${fmtVal(exact.alpha, 3)} (${pct(exact.alpha)}%)`,
      ],
    },
  ];
  if (base)
    steps.push({
      title: "محاسبه‌ی pH",
      text: `در دمای ۲۵ درجه مجموع pH و pOH برابر ۱۴ است (با جواب تقریبی، pH برابر ${faDigits(p2(approx.pH))} می‌شود).`,
      math: [`pH = 14 − pOH = 14 − ${p2(exact.pOH)} = ${p2(exact.pH)}`],
    });
  if (!approxValid) warnings.push("درصد یونش بیشتر از ۵٪ است؛ جواب روش تقریبی قابل اعتماد نیست و جواب دقیق را به کار ببرید.");

  const main: PhValues = { pH: exact.pH, pOH: exact.pOH, H: exact.H, OH: exact.OH };
  return ok(base ? "weak-base" : "weak-acid", main, steps, warnings, { approx, exact, approxValid });
}

/** اسید ضعیف با Ka (مقدارهای اصلی = جواب دقیق؛ روش تقریبی در weak.approx) */
export const weakAcid = (o: { c: number | string; ka: number | string; formula?: string }) => weak(false, { c: o.c, k: o.ka, formula: o.formula });
/** باز ضعیف با Kb */
export const weakBase = (o: { c: number | string; kb: number | string; formula?: string }) => weak(true, { c: o.c, k: o.kb, formula: o.formula });

export type PhQuantity = "pH" | "pOH" | "H" | "OH";

/** تبدیل یکی از pH، pOH، [H+]، [OH-] به بقیه */
export function convertPh(o: { from: PhQuantity; value: number | string }): PhResult {
  const x = parseNumberInput(o.value);
  if (x === null) return fail("مقدار واردشده عدد نیست.", "value");
  const warnings: string[] = [];
  let v: PhValues;
  const steps: ChemStep[] = [];
  if (o.from === "pH" || o.from === "pOH") {
    if (x < -2 || x > 16) return fail("مقدار pH یا pOH باید بین ۲- و ۱۶ باشد.", "value");
    if (x < 0 || x > 14)
      warnings.push("pH یا pOH خارج از بازه‌ی ۰ تا ۱۴ فقط در محلول‌های بسیار غلیظ دیده می‌شود؛ در مسئله‌های درسی معمولاً در این بازه است.");
    if (o.from === "pH") {
      v = valuesFromH(10 ** -x);
      steps.push(
        { title: "غلظت یون هیدروژن", math: [`${H_} = {{10^{-pH} }} = {{10^-${trimNum(x, 4)}}} = ${concMath(v.H)} mol/L`] },
        {
          title: "pOH و غلظت یون هیدروکسید",
          math: [`pOH = 14 − ${trimNum(x, 4)} = ${p2(v.pOH)}`, `${OH_} = {{10^{-pOH} }} = ${concMath(v.OH)} mol/L`],
        },
      );
    } else {
      v = valuesFromOH(10 ** -x);
      steps.push(
        { title: "غلظت یون هیدروکسید", math: [`${OH_} = {{10^{-pOH} }} = {{10^-${trimNum(x, 4)}}} = ${concMath(v.OH)} mol/L`] },
        {
          title: "pH و غلظت یون هیدروژن",
          math: [`pH = 14 − ${trimNum(x, 4)} = ${p2(v.pH)}`, `${H_} = {{10^{-pH} }} = ${concMath(v.H)} mol/L`],
        },
      );
    }
  } else {
    if (!(x > 0)) return fail("غلظت باید عددی مثبت باشد.", "value");
    if (x > 20) return fail("غلظت بیش از اندازه بزرگ است (بیشتر از ۲۰ مول بر لیتر).", "value");
    if (o.from === "H") {
      v = valuesFromH(x);
      steps.push(
        { title: "محاسبه‌ی pH", math: [`pH = −log${H_} = −log(${concMath(x)}) = ${p2(v.pH)}`] },
        { title: "pOH و غلظت یون هیدروکسید", math: [`pOH = 14 − ${p2(v.pH)} = ${p2(v.pOH)}`, `${OH_} = ${KW_} / ${H_} = ${concMath(v.OH)} mol/L`] },
      );
    } else {
      v = valuesFromOH(x);
      steps.push(
        { title: "محاسبه‌ی pOH", math: [`pOH = −log${OH_} = −log(${concMath(x)}) = ${p2(v.pOH)}`] },
        { title: "pH و غلظت یون هیدروژن", math: [`pH = 14 − ${p2(v.pOH)} = ${p2(v.pH)}`, `${H_} = ${KW_} / ${OH_} = ${concMath(v.H)} mol/L`] },
      );
    }
  }
  return ok("convert", v, steps, warnings);
}

export interface DilutionOk {
  ok: true;
  c1: number;
  v1: number;
  c2: number;
  v2: number;
  steps: ChemStep[];
}

/**
 * رقیق‌سازی: C1·V1 = C2·V2 (یکی از c2 یا v2 را خالی بگذارید). واحد حجم دو طرف باید یکسان باشد.
 */
export function dilution(o: { c1: number | string; v1: number | string; c2?: number | string | null; v2?: number | string | null }): DilutionOk | ChemFail {
  const c1 = parseNumberInput(o.c1);
  const v1 = parseNumberInput(o.v1);
  const c2in = o.c2 === undefined || o.c2 === null || o.c2 === "" ? null : parseNumberInput(o.c2);
  const v2in = o.v2 === undefined || o.v2 === null || o.v2 === "" ? null : parseNumberInput(o.v2);
  if (c1 === null || !(c1 > 0) || v1 === null || !(v1 > 0)) return fail("غلظت و حجم اولیه باید عددهای مثبت باشند.", "value");
  if ((c2in === null) === (v2in === null)) return fail("از غلظت نهایی و حجم نهایی دقیقاً یکی را وارد کنید.", "value");
  let c2: number, v2: number;
  const steps: ChemStep[] = [];
  if (v2in !== null) {
    if (!(v2in > 0)) return fail("حجم نهایی باید عددی مثبت باشد.", "value");
    if (v2in < v1) return fail("در رقیق‌سازی حجم نهایی نمی‌تواند کمتر از حجم اولیه باشد.", "value");
    v2 = v2in;
    c2 = (c1 * v1) / v2;
    steps.push({
      title: "پایستگی مول حل‌شونده",
      text: "با افزودن آب، مقدار مول حل‌شونده تغییر نمی‌کند؛ پس حاصل‌ضرب غلظت در حجم ثابت می‌ماند.",
      math: [`C1·V1 = C2·V2`, `C2 = C1·V1 / V2 = ${fmtVal(c1)} × ${fmtVal(v1)} / ${fmtVal(v2)} = ${fmtVal(c2)} mol/L`],
    });
  } else {
    if (!(c2in! > 0)) return fail("غلظت نهایی باید عددی مثبت باشد.", "value");
    if (c2in! > c1) return fail("در رقیق‌سازی غلظت نهایی نمی‌تواند بیشتر از غلظت اولیه باشد.", "value");
    c2 = c2in!;
    v2 = (c1 * v1) / c2;
    steps.push({
      title: "پایستگی مول حل‌شونده",
      text: "با افزودن آب، مقدار مول حل‌شونده تغییر نمی‌کند؛ پس حاصل‌ضرب غلظت در حجم ثابت می‌ماند.",
      math: [`C1·V1 = C2·V2`, `V2 = C1·V1 / C2 = ${fmtVal(c1)} × ${fmtVal(v1)} / ${fmtVal(c2)} = ${fmtVal(v2)}`],
    });
    steps.push({ title: "حجم آب افزوده", math: [`V2 − V1 = ${fmtVal(v2 - v1)}`] });
  }
  return { ok: true, c1, v1, c2, v2, steps };
}

export interface PhPreset {
  formula: string;
  fa: string;
  kind: "strong-acid" | "strong-base" | "weak-acid" | "weak-base";
  /** تعداد یون H+ یا OH- هر واحد (قوی‌ها) */
  n?: number;
  /** Ka یا Kb در ۲۵ درجه (ضعیف‌ها) */
  k?: number;
  /** ⚠️ مقدار یا قرارداد باید با کتاب درسی و استاد تأیید شود */
  teacherConfirm?: boolean;
}

/**
 * نمونه‌های آماده‌ی ابزار pH. مقدارهای Ka و Kb مرجع رایج در ۲۵ درجه‌اند (گردشده) و با پرچم teacherConfirm
 * علامت خورده‌اند تا با مقدارهای کتاب درسی تطبیق داده شوند.
 */
export const PH_PRESETS: PhPreset[] = [
  { formula: "HCl", fa: "هیدروکلریک اسید", kind: "strong-acid", n: 1 },
  { formula: "HBr", fa: "هیدروبرمیک اسید", kind: "strong-acid", n: 1 },
  { formula: "HI", fa: "هیدرویدیک اسید", kind: "strong-acid", n: 1 },
  { formula: "HNO3", fa: "نیتریک اسید", kind: "strong-acid", n: 1 },
  { formula: "HClO4", fa: "پرکلریک اسید", kind: "strong-acid", n: 1 },
  { formula: "H2SO4", fa: "سولفوریک اسید", kind: "strong-acid", n: 2, teacherConfirm: true },
  { formula: "NaOH", fa: "سدیم هیدروکسید", kind: "strong-base", n: 1 },
  { formula: "KOH", fa: "پتاسیم هیدروکسید", kind: "strong-base", n: 1 },
  { formula: "LiOH", fa: "لیتیم هیدروکسید", kind: "strong-base", n: 1 },
  { formula: "Ba(OH)2", fa: "باریم هیدروکسید", kind: "strong-base", n: 2 },
  { formula: "CH3COOH", fa: "استیک اسید", kind: "weak-acid", k: 1.8e-5, teacherConfirm: true },
  { formula: "HCOOH", fa: "فورمیک اسید (متانوئیک اسید)", kind: "weak-acid", k: 1.8e-4, teacherConfirm: true },
  { formula: "HF", fa: "هیدروفلوئوریک اسید", kind: "weak-acid", k: 6.8e-4, teacherConfirm: true },
  { formula: "NH3", fa: "آمونیاک", kind: "weak-base", k: 1.8e-5, teacherConfirm: true },
];
