/**
 * انواع و ابزارهای مشترک کتابخانه‌ی شیمی (خالص و ایزومورفیک؛ بدون وابستگی).
 *
 * قرارداد متن مرحله‌ها (ChemStep):
 * - `text` نثر فارسی با رقم فارسی است؛ فرمول‌ها داخل {{…}} و پررنگ‌ها داخل **…** آمده‌اند تا مستقیم به
 *   <ChemText> داده شوند (src/components/seo/Chem.tsx).
 * - پیام‌های خطا و هشدار هم همین نحو {{…}} را دارند (پس با <ChemText> نمایش داده شوند)؛ تکه‌های کدی که کاربر باید
 *   تایپ کند با ltr() جدا شده‌اند.
 * - هر خط `math` یک عبارت چپ‌به‌راست با رقم لاتین است (مثل «n = m / M = 9 / 18 = 0.5 mol»)؛ فرمول‌ها و نماد عنصرها
 *   در آن هم داخل {{…}} هستند و توان‌ده با ^ نوشته می‌شود (10^-14) که <ChemText> بالانویس می‌کند.
 *   نمایش‌دهنده آن را در <bdi dir="ltr"> قرار می‌دهد و در صورت نیاز می‌تواند رقم‌ها را فارسی کند.
 */

/**
 * جداسازی چپ‌به‌راست یک تکه‌ی کد (مثل «(»، «Fe^3+»، «->») داخل پیام فارسی با نویسه‌های LRI/PDI
 * تا پرانتز آینه‌ای نشود و علامت‌ها جابه‌جا نمایش داده نشوند.
 */
export const ltr = (s: string | number) => `\u2066${s}\u2069`;

/** یک مرحله‌ی حل برای نمایش */
export interface ChemStep {
  title: string;
  text?: string;
  math?: string[];
}

/** خطای ورودی کاربر با پیام فارسی */
export class ChemError extends Error {
  constructor(
    message: string,
    public code: string = "input",
  ) {
    super(message);
    this.name = "ChemError";
  }
}

/** نتیجه‌ی ناموفق یکسان برای همه‌ی حل‌کننده‌ها */
export interface ChemFail {
  ok: false;
  code: string;
  error: string;
}

export const fail = (error: string, code = "input"): ChemFail => ({ ok: false, code, error });

/** هر خطا → نتیجه‌ی ناموفق؛ خطای غیرمنتظره پیام عمومی می‌گیرد */
export function toFail(e: unknown): ChemFail {
  if (e instanceof ChemError) return fail(e.message, e.code);
  return fail("محاسبه انجام نشد؛ ورودی را بررسی کنید.", "internal");
}

const FA = "۰۱۲۳۴۵۶۷۸۹";

/** رقم لاتین → فارسی و نقطه‌ی اعشار → «٫» (برای نثر) */
export const faDigits = (v: string | number) =>
  String(v)
    .replace(/(\d)\.(\d)/g, "$1٫$2")
    .replace(/\d/g, (d) => FA[Number(d)]);

/** گرد کردن ایمن تا n رقم اعشار (بدون خطای ممیز شناور مثل 18.015000000000001) */
export function roundTo(x: number, n: number): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** n;
  return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
}

/** نمایش عدد با n رقم اعشار ثابت (رقم لاتین؛ برای خطوط math) */
export const fixed = (x: number, n: number) => roundTo(x, n).toFixed(n);

/** عدد بدون صفرهای اضافه‌ی انتهای اعشار */
export function trimNum(x: number, maxDecimals = 6): string {
  const s = roundTo(x, maxDecimals).toFixed(maxDecimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/**
 * نمایش علمی با sig رقم بامعنا به نحو قرارداد Chem: «3.01×10^23».
 * برای توان‌های کوچک (۰ تا ۳ و ۱- تا ۲-) عدد معمولی برمی‌گرداند مگر force داده شود.
 */
export function sci(x: number, sig = 3, force = false): string {
  if (x === 0) return "0";
  if (!Number.isFinite(x)) return String(x);
  const exp = Math.floor(Math.log10(Math.abs(x)));
  if (!force && exp >= -2 && exp <= 3) return trimNum(Number(x.toPrecision(sig)), 10);
  let m = x / 10 ** exp;
  let e = exp;
  let ms = m.toFixed(Math.max(0, sig - 1));
  if (Math.abs(Number(ms)) >= 10) {
    // گرد شدن 9.995 → 10.0
    e += 1;
    m = x / 10 ** e;
    ms = m.toFixed(Math.max(0, sig - 1));
  }
  return `${ms}×10^${e}`;
}

/** بخش‌های نماد علمی برای نمایش سفارشی */
export function sciParts(x: number, sig = 3): { mantissa: string; exponent: number } {
  if (x === 0) return { mantissa: "0", exponent: 0 };
  let e = Math.floor(Math.log10(Math.abs(x)));
  let ms = (x / 10 ** e).toFixed(Math.max(0, sig - 1));
  if (Math.abs(Number(ms)) >= 10) {
    e += 1;
    ms = (x / 10 ** e).toFixed(Math.max(0, sig - 1));
  }
  return { mantissa: ms, exponent: e };
}

/** «a، b و c» */
export function faList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("، ")} و ${items[items.length - 1]}`;
}

/** نماد علمی برای خطوط math: توان ده داخل {{…}} تا <ChemText> بالانویس کند؛ «3.01×{{10^23}}» */
export function sciMath(x: number, sig = 3, force = false): string {
  const s = sci(x, sig, force);
  return s.replace(/×10\^(-?\d+)$/, "×{{10^$1}}");
}

/** عدد مقدار فیزیکی برای خطوط math: بازه‌ی معمولی با ۴ رقم بامعنا، بیرون از آن نماد علمی */
export function fmtVal(x: number, sig = 4): string {
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e5) return trimNum(Number(x.toPrecision(sig)), 10);
  return concMath(x);
}

/** نماد علمی غلظت برای خطوط math با حداکثر ۳ رقم بامعنا و دست‌کم یک رقم اعشار: «1.0×{{10^-2}}»، «1.34×{{10^-3}}» */
export function concMath(x: number): string {
  return sciMath(x, 3, true).replace(/^(-?\d\.\d)(\d)?×/, (_, a: string, b?: string) => `${a}${b && b !== "0" ? b : ""}×`);
}
