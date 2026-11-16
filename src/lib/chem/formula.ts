/**
 * تجزیه‌ی فرمول شیمیایی (خالص و ایزومورفیک).
 *
 * پشتیبانی: پرانتز و کروشه‌ی تودرتو، آب تبلور (CuSO4·5H2O، CuSO4.5H2O، CuSO4*5H2O)، ضریب ابتدایی،
 * بار با ^ (SO4^2-، Fe^{3+}، NH4^+) یا پسوند جدا (SO4 2-)، علامت تنها در انتها (Na+، Cl-)، الکترون (e-، e^-)
 * و حالت فیزیکی ((s)، (l)، (g)، (aq)).
 * هم‌خوان با نمایش <Chem>: رقم چسبیده به علامت انتهایی بدون ^ زیروند است (Fe3+ = Fe₃⁺)، پس بار چندتایی
 * را با ^ بنویسید؛ در این حالت هشدار برمی‌گردد.
 */
import { ChemError, ltr, toFail, type ChemFail } from "./common";
import { isElementSymbol } from "./masses";
import { normalizeChemText } from "./normalize";

export type PhysState = "s" | "l" | "g" | "aq";

export interface FormulaPart {
  /** ضریب بخش آب تبلور (برای بخش اول ۱) */
  multiplier: number;
  /** متن بخش بدون ضریب */
  text: string;
  counts: Record<string, number>;
}

export interface ParsedFormula {
  /** ورودی خام */
  input: string;
  /** فرمول بدون ضریب، بار و حالت (یکسان‌شده، آب تبلور با «·») */
  body: string;
  /** نحو قرارداد <Chem> بدون ضریب: بدنه + بار با ^ + حالت؛ مثل «SO4^2-(aq)» */
  display: string;
  /** ضریب نوشته‌شده در ابتدای گونه (پیش‌فرض ۱) */
  coefficient: number;
  /** تعداد اتم هر عنصر به ترتیب نخستین ظهور */
  counts: Record<string, number>;
  /** بار الکتریکی گونه */
  charge: number;
  isElectron: boolean;
  state?: PhysState;
  /** بخش‌های آب تبلور (اگر فرمول «·» داشته باشد بیش از یکی است) */
  parts: FormulaPart[];
  warnings: string[];
}

/** پسوند بار به نحو قرارداد Chem: 0 → ""، 1 → «^+»، -2 → «^2-» */
export function chargeSuffix(charge: number): string {
  if (!charge) return "";
  const mag = Math.abs(charge);
  return `^${mag === 1 ? "" : mag}${charge > 0 ? "+" : "-"}`;
}

/** متن فارسی بار برای پیام‌ها: «۲+» به‌صورت لاتین در {{}} نیاید؛ اینجا عدد علامت‌دار ساده */
export const chargeText = (charge: number) => (charge === 0 ? "0" : `${Math.abs(charge)}${charge > 0 ? "+" : "-"}`);

const STATE_RE = /\((s|l|g|aq)\)$/;
const OPEN: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const CLOSE = new Set([")", "]", "}"]);

/** ادغام تعداد اتم‌ها با ضریب */
function addInto(target: Record<string, number>, src: Record<string, number>, k = 1) {
  for (const [el, n] of Object.entries(src)) {
    const v = (target[el] ?? 0) + n * k;
    if (!Number.isSafeInteger(v)) throw new ChemError("تعداد اتم‌ها بیش از حد بزرگ است.", "too-big");
    target[el] = v;
  }
}

/** تجزیه‌ی یک بخش بدون «·» (با پرانتز و کروشه‌ی تودرتو) */
function parseGroup(text: string, full: string): Record<string, number> {
  const stack: { counts: Record<string, number>; open: string }[] = [{ counts: {}, open: "" }];
  let i = 0;
  let lastWasGroupStart = false;
  while (i < text.length) {
    const ch = text[i];
    const rest = text.slice(i);
    if (ch in OPEN) {
      stack.push({ counts: {}, open: ch });
      i++;
      lastWasGroupStart = true;
      continue;
    }
    if (CLOSE.has(ch)) {
      if (stack.length === 1) throw new ChemError(`پرانتز بسته‌ی «${ltr(ch)}» در «${ltr(full)}» اضافه است.`, "extra-close");
      const top = stack.pop()!;
      if (OPEN[top.open] !== ch) throw new ChemError(`پرانتز «${ltr(top.open)}» با «${ltr(ch)}» بسته شده است.`, "mismatch");
      if (!Object.keys(top.counts).length) throw new ChemError(`پرانتز خالی «${ltr(top.open + ch)}» در فرمول آمده است.`, "empty-group");
      i++;
      const num = /^\d+/.exec(text.slice(i));
      const k = num ? Number(num[0]) : 1;
      if (num) {
        if (k === 0) throw new ChemError("زیروند صفر معتبر نیست.", "zero");
        i += num[0].length;
      }
      addInto(stack[stack.length - 1].counts, top.counts, k);
      lastWasGroupStart = false;
      continue;
    }
    const el = /^[A-Z][a-z]?/.exec(rest);
    if (el) {
      const sym = el[0];
      if (!isElementSymbol(sym)) {
        // «Co» معتبر است، «Xx» نه؛ حرف کوچک تنها نماد مستقل نیست
        throw new ChemError(`عنصر ${sym} وجود ندارد.`, "unknown-element");
      }
      i += sym.length;
      const num = /^\d+/.exec(text.slice(i));
      const k = num ? Number(num[0]) : 1;
      if (num) {
        if (k === 0) throw new ChemError("زیروند صفر معتبر نیست.", "zero");
        i += num[0].length;
      }
      addInto(stack[stack.length - 1].counts, { [sym]: 1 }, k);
      lastWasGroupStart = false;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      const word = /^[a-z]+/.exec(rest)![0];
      throw new ChemError(
        `«${word}» نماد عنصر نیست؛ نماد عنصرها با حرف بزرگ شروع می‌شوند (مثلاً Co برای کبالت یا CO برای کربن مونوکسید).`,
        "lowercase",
      );
    }
    if (/\d/.test(ch)) {
      throw new ChemError(
        lastWasGroupStart ? "عدد نباید بلافاصله بعد از پرانتز باز بیاید." : `عدد «${/^\d+/.exec(rest)![0]}» جای درستی در فرمول ندارد.`,
        "stray-number",
      );
    }
    if (ch === " ") throw new ChemError("فاصله در میان فرمول مجاز نیست.", "space");
    throw new ChemError(`نویسه‌ی «${ltr(ch)}» در فرمول مجاز نیست.`, "bad-char");
  }
  if (stack.length > 1) {
    const open = stack[stack.length - 1].open;
    throw new ChemError(open === "[" ? `کروشه «${ltr("[")}» بسته نشده است.` : `پرانتز «${ltr(open)}» بسته نشده است.`, "unclosed");
  }
  return stack[0].counts;
}

/** جدا کردن بار از انتهای بدنه */
function extractCharge(s: string, warnings: string[]): { body: string; charge: number } {
  // ^2-، ^{2-}، ^-2، ^+، ^{+}
  let m = /\^\{?(\d*)([+-])\}?$/.exec(s) ?? /\^\{?([+-])(\d*)\}?$/.exec(s);
  if (m) {
    const [digits, sign] = /\d/.test(m[1]) || m[1] === "" ? [m[1], m[2]] : [m[2], m[1]];
    const mag = digits ? Number(digits) : 1;
    if (mag === 0) throw new ChemError("بار صفر را ننویسید.", "zero-charge");
    return { body: s.slice(0, m.index), charge: sign === "-" ? -mag : mag };
  }
  if (/\^/.test(s)) throw new ChemError(`بار را به شکل ${ltr("^2-")} یا ${ltr("^+")} در انتهای فرمول بنویسید.`, "bad-charge");
  // {3+} بدون ^
  m = /\{(\d*)([+-])\}$/.exec(s);
  if (m) {
    const mag = m[1] ? Number(m[1]) : 1;
    return { body: s.slice(0, m.index), charge: m[2] === "-" ? -mag : mag };
  }
  // پسوند جدا: «SO4 2-»
  m = /^(.*\S)\s+(\d*)([+-])$/.exec(s);
  if (m) {
    const mag = m[2] ? Number(m[2]) : 1;
    return { body: m[1], charge: m[3] === "-" ? -mag : mag };
  }
  // علامت‌های تنها در انتها: Na+، Cl-، Fe+++
  m = /([+-]+)$/.exec(s);
  if (m) {
    const signs = m[1];
    if (/\+/.test(signs) && /-/.test(signs)) throw new ChemError("علامت بار نامعتبر است.", "bad-charge");
    const body = s.slice(0, m.index);
    const mag = signs.length;
    if (mag === 1) {
      // «Fe3+» یا «O2-»: تک‌عنصر با زیروند؛ «SO42-»: زیروند چندرقمی پیش از علامت. هر دو احتمالاً بار چندتایی‌اند.
      const single = /^([A-Z][a-z]?)(\d+)$/.exec(body);
      const multi = /^(.*[A-Za-z)\]]\d*)(\d)$/.exec(body);
      let hint = "";
      if (single && single[2] !== "1") hint = `${single[1]}^${single[2]}${signs}`;
      else if (multi && /\d\d$/.test(body)) hint = `${multi[1]}^${multi[2]}${signs}`;
      if (hint)
        warnings.push(
          `«${ltr(s)}» با زیروند و بار ${ltr(signs)} خوانده شد؛ اگر منظور یون با بار چندتایی است، آن را به شکل ${ltr(hint)} بنویسید.`,
        );
    }
    return { body, charge: signs[0] === "-" ? -mag : mag };
  }
  return { body: s, charge: 0 };
}

/**
 * تجزیه‌ی یک گونه (فرمول یا یون یا الکترون).
 * خطای ورودی را با ChemError و پیام فارسی پرتاب می‌کند.
 */
export function parseFormula(input: string): ParsedFormula {
  const warnings: string[] = [];
  let s = normalizeChemText(input);
  if (!s) throw new ChemError("فرمولی وارد نشده است.", "empty");

  // حالت فیزیکی
  let state: PhysState | undefined;
  const st = STATE_RE.exec(s);
  if (st) {
    state = st[1] as PhysState;
    s = s.slice(0, st.index).trim();
  }

  // ضریب ابتدایی
  let coefficient = 1;
  const cm = /^(\d+)\s*(?=[A-Z(\[{e])/.exec(s);
  if (cm) {
    coefficient = Number(cm[1]);
    if (coefficient === 0) throw new ChemError("ضریب صفر معتبر نیست.", "zero");
    s = s.slice(cm[0].length);
  }

  const { body: rawBody, charge } = extractCharge(s, warnings);
  const body = rawBody.trim();

  // الکترون
  if (body === "e") {
    if (charge !== -1) throw new ChemError(`الکترون را به شکل ${ltr("e-")} یا ${ltr("e^-")} بنویسید.`, "electron");
    return {
      input,
      body: "e",
      display: `e^-${state ? `(${state})` : ""}`,
      coefficient,
      counts: {},
      charge: -1,
      isElectron: true,
      state,
      parts: [],
      warnings,
    };
  }
  if (!body) throw new ChemError("فرمول خالی است.", "empty");

  // بخش‌های آب تبلور
  const rawParts = body.split("·");
  const parts: FormulaPart[] = [];
  const counts: Record<string, number> = {};
  rawParts.forEach((p, idx) => {
    const t = p.trim();
    if (!t) throw new ChemError(idx === 0 ? "پیش از «·» فرمولی نیامده است." : "بعد از «·» فرمول آب تبلور نیامده است.", "empty-part");
    let multiplier = 1;
    let text = t;
    if (idx > 0) {
      const mm = /^(\d+)/.exec(t);
      if (mm) {
        multiplier = Number(mm[1]);
        if (multiplier === 0) throw new ChemError("ضریب صفر معتبر نیست.", "zero");
        text = t.slice(mm[0].length);
        if (!text) throw new ChemError(`بعد از ضریب ${multiplier} فرمولی نیامده است.`, "empty-part");
      }
    }
    const c = parseGroup(text, t);
    addInto(counts, c, multiplier);
    parts.push({ multiplier, text, counts: c });
  });

  const display = `${body}${chargeSuffix(charge)}${state ? `(${state})` : ""}`;
  return { input, body, display, coefficient, counts, charge, isElectron: false, state, parts, warnings };
}

export type FormulaResult = ({ ok: true } & ParsedFormula) | ChemFail;

/** نسخه‌ی بدون پرتاب خطا برای رابط کاربری */
export function tryParseFormula(input: string): FormulaResult {
  try {
    return { ok: true, ...parseFormula(input) };
  } catch (e) {
    return toFail(e);
  }
}

/** تعداد کل اتم‌ها */
export const atomTotal = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
