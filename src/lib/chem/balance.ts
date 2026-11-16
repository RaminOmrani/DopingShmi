/**
 * موازنه‌ی معادله‌ی شیمیایی با حل دقیق دستگاه خطی (خالص و ایزومورفیک).
 *
 * روش: برای هر عنصر (و برای بار الکتریکی در معادله‌های یونی) یک معادله‌ی پایستگی؛ فضای پوچ ماتریس
 * با کسرهای BigInt دقیق حساب می‌شود. بُعد ۱ → کوچک‌ترین ضریب‌های صحیح؛ بُعد ۰ → موازنه ممکن نیست؛
 * بُعد ۲ یا بیشتر → ضریب‌ها یکتا نیستند (معمولاً دو واکنش مستقل در یک معادله).
 */
import { ChemError, faDigits, faList, fail, toFail, type ChemFail, type ChemStep } from "./common";
import { chargeText, parseFormula, type ParsedFormula } from "./formula";
import { splitEquation, splitSpecies, type ArrowKind } from "./normalize";
import { Frac, nullSpace, toSmallestIntegers } from "./rational";

export interface BalanceSpecies {
  /** نحو قرارداد <Chem> بدون ضریب (بار با ^ و حالت فیزیکی) */
  formula: string;
  coef: number;
  side: "reactant" | "product";
  parsed: ParsedFormula;
}

export interface TallyRow {
  /** نماد عنصر یا «charge» برای بار */
  key: string;
  left: number;
  right: number;
}

export interface BalanceOk {
  ok: true;
  arrow: ArrowKind;
  species: BalanceSpecies[];
  /** ضریب‌ها به ترتیب گونه‌ها */
  coefficients: number[];
  /** معادله‌ی موازنه‌شده به نحو <Eq>: «2H2 + O2 -> 2H2O» */
  equation: string;
  /** شمارش اتم هر عنصر (و بار، اگر معادله یونی باشد) در دو سمت پس از موازنه */
  tally: TallyRow[];
  ionic: boolean;
  steps: ChemStep[];
  warnings: string[];
}

export type BalanceFailCode = "parse" | "input" | "impossible" | "ambiguous";

export interface BalanceFail extends ChemFail {
  code: BalanceFailCode;
  /** گونه‌های تجزیه‌شده، اگر تجزیه موفق بوده باشد */
  species?: { formula: string; side: "reactant" | "product" }[];
  /** هشدارهای تجزیه (مثل «Fe3+ را Fe^3+ بنویسید») که اغلب علت شکست‌اند */
  warnings: string[];
}

export type BalanceResult = BalanceOk | BalanceFail;

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const letter = (i: number) => (i < 26 ? LETTERS[i] : `x${i + 1}`);

const MAX_SPECIES = 20;

/** جمله‌های یک سمت معادله‌ی پایستگی: «2a + b» */
function sideTerms(vals: { k: number; i: number }[]): string {
  const parts = vals.filter((v) => v.k !== 0).map((v) => `${v.k === 1 ? "" : v.k === -1 ? "-" : v.k}${letter(v.i)}`);
  return parts.length ? parts.join(" + ").replace(/\+ -/g, "- ") : "0";
}

const bfail = (error: string, code: BalanceFailCode, species?: BalanceSpecies[]): BalanceFail => ({
  ...fail(error, code),
  code,
  species: species?.map((s) => ({ formula: s.formula, side: s.side })),
  warnings: species ? [...new Set(species.flatMap((s) => s.parsed.warnings))] : [],
});

/**
 * موازنه‌ی یک معادله.
 * ورودی‌ها: «H2 + O2 -> H2O»، «Fe + O2 = Fe2O3»، «MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O»
 */
export function balanceEquation(input: string): BalanceResult {
  let left: string, right: string, arrow: ArrowKind;
  try {
    ({ left, right, arrow } = splitEquation(input));
  } catch (e) {
    const f = toFail(e);
    return bfail(f.error, "input");
  }

  const species: BalanceSpecies[] = [];
  const warnings: string[] = [];
  try {
    for (const [side, text] of [
      ["reactant", left],
      ["product", right],
    ] as const) {
      for (const raw of splitSpecies(text)) {
        if (!raw) throw new ChemError("جای یک گونه خالی است؛ دو «+» پشت سر هم یا «+» در ابتدا/انتهای یک سمت آمده است.", "empty-species");
        const p = parseFormula(raw);
        species.push({ formula: p.display, coef: 0, side, parsed: p });
        warnings.push(...p.warnings);
      }
    }
  } catch (e) {
    const f = toFail(e);
    return bfail(f.error, "parse");
  }
  if (species.length > MAX_SPECIES) return bfail(`حداکثر ${faDigits(MAX_SPECIES)} گونه پشتیبانی می‌شود.`, "input");
  if (species.length < 2) return bfail("دست‌کم یک واکنش‌دهنده و یک فراورده لازم است.", "input");
  if (species.some((s) => s.parsed.coefficient !== 1))
    warnings.push("ضریب‌هایی که نوشته بودید نادیده گرفته شدند و ضریب‌ها از نو حساب شدند.");

  const reactants = species.filter((s) => s.side === "reactant");
  const products = species.filter((s) => s.side === "product");

  // عنصرها به ترتیب نخستین ظهور
  const elements: string[] = [];
  for (const s of species) for (const el of Object.keys(s.parsed.counts)) if (!elements.includes(el)) elements.push(el);
  if (!elements.length) return bfail("در معادله هیچ عنصری نیست.", "input", species);

  // عنصری که فقط در یک سمت آمده است
  const onlyLeft = elements.filter((el) => reactants.some((s) => s.parsed.counts[el]) && !products.some((s) => s.parsed.counts[el]));
  const onlyRight = elements.filter((el) => products.some((s) => s.parsed.counts[el]) && !reactants.some((s) => s.parsed.counts[el]));
  if (onlyLeft.length || onlyRight.length) {
    const msgs: string[] = [];
    if (onlyLeft.length)
      msgs.push(`${faList(onlyLeft.map((e) => `{{${e}}}`))} فقط در واکنش‌دهنده‌ها ${onlyLeft.length > 1 ? "آمده‌اند" : "آمده است"}`);
    if (onlyRight.length)
      msgs.push(`${faList(onlyRight.map((e) => `{{${e}}}`))} فقط در فراورده‌ها ${onlyRight.length > 1 ? "آمده‌اند" : "آمده است"}`);
    return bfail(
      `این معادله موازنه نمی‌شود: ${msgs.join(" و ")}. طبق قانون پایستگی جرم، هر عنصر باید در هر دو سمت باشد؛ فرمول‌ها را بررسی کنید.`,
      "impossible",
      species,
    );
  }

  const ionic = species.some((s) => s.parsed.charge !== 0);
  const rowsKeys = ionic ? [...elements, "charge"] : elements;
  const sign = (s: BalanceSpecies) => (s.side === "reactant" ? 1 : -1);
  const matrix: Frac[][] = rowsKeys.map((key) =>
    species.map((s) => Frac.of(sign(s) * (key === "charge" ? s.parsed.charge : (s.parsed.counts[key] ?? 0)))),
  );

  // معادله‌های پایستگی برای نمایش
  const conservation = rowsKeys.map((key) => {
    const val = (s: BalanceSpecies) => (key === "charge" ? s.parsed.charge : (s.parsed.counts[key] ?? 0));
    const l = sideTerms(species.map((s, i) => ({ k: s.side === "reactant" ? val(s) : 0, i })));
    const r = sideTerms(species.map((s, i) => ({ k: s.side === "product" ? val(s) : 0, i })));
    return `${key === "charge" ? "q" : `{{${key}}}`}: ${l} = ${r}`;
  });

  const basis = nullSpace(matrix);
  if (basis.length === 0)
    return bfail(
      "این معادله با این گونه‌ها موازنه نمی‌شود (دستگاه معادله‌ها فقط جواب صفر دارد). فرمول‌ها، بارها و جای واکنش‌دهنده‌ها و فراورده‌ها را بررسی کنید.",
      "impossible",
      species,
    );
  if (basis.length > 1)
    return bfail(
      `ضریب‌های این معادله یکتا نیستند (${faDigits(basis.length)} موازنه‌ی مستقل وجود دارد)؛ معمولاً یعنی دو یا چند واکنش جدا در یک معادله آمده‌اند. واکنش‌ها را جدا بنویسید یا گونه‌ی اضافه را حذف کنید.`,
      "ambiguous",
      species,
    );

  const v = basis[0];
  let ints = toSmallestIntegers(v);
  if (ints.every((x) => x <= 0n)) ints = ints.map((x) => -x);
  const zero = species.filter((_, i) => ints[i] === 0n);
  if (zero.length)
    return bfail(
      `${faList(zero.map((s) => `{{${s.formula}}}`))} در این واکنش شرکت نمی‌کند (ضریب آن صفر می‌شود)؛ گونه‌ها را بررسی کنید.`,
      "impossible",
      species,
    );
  if (ints.some((x) => x < 0n)) {
    const wrong = species.filter((_, i) => ints[i] < 0n);
    return bfail(
      `با این گونه‌ها موازنه فقط وقتی ممکن است که ${faList(wrong.map((s) => `{{${s.formula}}}`))} در سمت دیگر معادله باشد؛ جای واکنش‌دهنده‌ها و فراورده‌ها را بررسی کنید.`,
      "impossible",
      species,
    );
  }
  if (ints.some((x) => x > BigInt(Number.MAX_SAFE_INTEGER))) return bfail("ضریب‌ها بیش از حد بزرگ‌اند.", "input", species);

  const coefficients = ints.map(Number);
  species.forEach((s, i) => (s.coef = coefficients[i]));

  const term = (s: BalanceSpecies) => `${s.coef === 1 ? "" : s.coef}${s.formula}`;
  const equation = `${reactants.map(term).join(" + ")} ${arrow === "⇌" ? "<=>" : "->"} ${products.map(term).join(" + ")}`;

  const tally: TallyRow[] = rowsKeys.map((key) => {
    const val = (s: BalanceSpecies) => (key === "charge" ? s.parsed.charge : (s.parsed.counts[key] ?? 0)) * s.coef;
    return { key, left: reactants.reduce((a, s) => a + val(s), 0), right: products.reduce((a, s) => a + val(s), 0) };
  });

  // جواب گویا پیش از صحیح کردن (آخرین متغیر آزاد = ۱)
  // (پس از بررسی علامت‌ها همه‌ی مؤلفه‌ها هم‌علامت‌اند؛ آخرین متغیر آزاد ۱ است)
  const vPos = v[0].sign() < 0 ? v.map((x) => x.neg()) : v;
  const rational = vPos.map((x, i) => `${letter(i)} = ${x.toString()}`);
  const needsScale = vPos.some((x) => !x.isInteger());

  const steps: ChemStep[] = [
    {
      title: "نام‌گذاری ضریب‌ها",
      text: "برای هر گونه یک ضریب مجهول در نظر می‌گیریم.",
      math: [
        `${species.map((s, i) => `${letter(i)}·{{${s.formula}}}`).slice(0, reactants.length).join(" + ")} → ${species
          .map((s, i) => `${letter(i)}·{{${s.formula}}}`)
          .slice(reactants.length)
          .join(" + ")}`,
      ],
    },
    {
      title: ionic ? "پایستگی اتم‌ها و بار" : "پایستگی اتم‌ها",
      text: ionic
        ? "تعداد اتم‌های هر عنصر و مجموع بار الکتریکی (q) باید در دو سمت برابر باشد."
        : "طبق قانون پایستگی جرم، تعداد اتم‌های هر عنصر در دو سمت برابر است؛ برای هر عنصر یک معادله می‌نویسیم.",
      math: conservation,
    },
    {
      title: "حل دستگاه",
      text: needsScale
        ? "یکی از ضریب‌ها را ۱ می‌گیریم و بقیه را برحسب آن به دست می‌آوریم؛ سپس همه را در کوچک‌ترین عدد لازم ضرب می‌کنیم تا ضریب‌ها کوچک‌ترین عددهای صحیح شوند."
        : "یکی از ضریب‌ها را ۱ می‌گیریم و بقیه را برحسب آن به دست می‌آوریم؛ همه صحیح و کوچک‌ترین‌اند.",
      math: needsScale
        ? [rational.join(", "), coefficients.map((c, i) => `${letter(i)} = ${c}`).join(", ")]
        : [coefficients.map((c, i) => `${letter(i)} = ${c}`).join(", ")],
    },
    {
      title: "بررسی",
      text: "تعداد اتم‌ها" + (ionic ? " و بار کل" : "") + " در دو سمت معادله‌ی موازنه‌شده برابر است.",
      math: tally.map((t) => (t.key === "charge" ? `q: ${chargeText(t.left)} = ${chargeText(t.right)}` : `{{${t.key}}}: ${t.left} = ${t.right}`)),
    },
  ];

  return { ok: true, arrow, species, coefficients, equation, tally, ionic, steps, warnings: [...new Set(warnings)] };
}
