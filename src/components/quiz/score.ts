/**
 * نمره‌دهی و ذخیره‌ی محلی نتیجه‌ی آزمون‌های آنلاین رایگان (خالص؛ در سرور، کلاینت و تست قابل استفاده).
 * هیچ چیزی به سرور فرستاده نمی‌شود؛ آخرین نتیجه فقط در localStorage همان مرورگر می‌ماند.
 */

export type QuestionResult = "correct" | "wrong" | "blank";

export interface QuizScore {
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  /** درصد بدون نمره‌ی منفی: درست ÷ کل × ۱۰۰ */
  percent: number;
  /** درصد با نمره‌ی منفی (هر پاسخ نادرست منهای یک‌سوم): (۳ × درست − نادرست) ÷ (۳ × کل) × ۱۰۰ */
  percentNeg: number;
}

/** وضعیت یک سؤال: بی‌پاسخ، درست یا نادرست */
export const resultOf = (key: number, pick: number | null | undefined): QuestionResult =>
  pick === null || pick === undefined ? "blank" : pick === key ? "correct" : "wrong";

/** نمره‌ی آزمون از روی کلید (شماره‌ی گزینه‌ی درست از صفر) و انتخاب‌ها (null = بی‌پاسخ) */
export function scoreQuiz(keys: readonly number[], picks: readonly (number | null | undefined)[]): QuizScore {
  let correct = 0;
  let wrong = 0;
  keys.forEach((k, i) => {
    const r = resultOf(k, picks[i]);
    if (r === "correct") correct++;
    else if (r === "wrong") wrong++;
  });
  const total = keys.length;
  const blank = total - correct - wrong;
  return {
    total,
    correct,
    wrong,
    blank,
    percent: total ? (correct / total) * 100 : 0,
    percentNeg: total ? ((3 * correct - wrong) / (3 * total)) * 100 : 0,
  };
}

const NF = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

/** درصد با یک رقم اعشار و رقم فارسی: «۶۲٫۵٪»، «‎−۳۳٫۳٪» (منفی صفر → «۰٪») */
export const fmtPercent = (x: number) => `${NF.format(Math.round(x * 10) / 10 || 0)}٪`;

/** آخرین نتیجه‌ی ذخیره‌شده در همین مرورگر */
export interface SavedScore {
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  percent: number;
  percentNeg: number;
  /** زمان ثبت (میلی‌ثانیه) */
  at: number;
}

/** کلید localStorage هر آزمون: «ds-quiz:dahom-fasl-1» */
export const quizStorageKey = (slug: string) => `ds-quiz:${slug}`;

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "setItem">;

const isSaved = (v: unknown): v is SavedScore =>
  !!v &&
  typeof v === "object" &&
  ["total", "correct", "wrong", "blank", "percent", "percentNeg", "at"].every((k) => typeof (v as Record<string, unknown>)[k] === "number");

/** خواندن آخرین نتیجه؛ هر خطا (حالت خصوصی، دسترسی مسدود، JSON خراب) → null. store پیش‌فرض: localStorage */
export function loadScore(key: string, store?: ReadStore | null): SavedScore | null {
  try {
    const st = store === undefined ? globalThis.localStorage : store;
    const raw = st?.getItem(key);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return isSaved(v) ? v : null;
  } catch {
    return null;
  }
}

/** ذخیره‌ی نتیجه؛ در صورت خطا (فضای پر، دسترسی مسدود) false و بدون پرتاب خطا */
export function saveScore(key: string, s: QuizScore, store?: WriteStore | null, now = Date.now()): boolean {
  try {
    const st = store === undefined ? globalThis.localStorage : store;
    if (!st) return false;
    const v: SavedScore = { total: s.total, correct: s.correct, wrong: s.wrong, blank: s.blank, percent: s.percent, percentNeg: s.percentNeg, at: now };
    st.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
