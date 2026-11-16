/**
 * فهرست آزمون‌های آنلاین فصل‌به‌فصل و کمک‌تابع‌های مسیر، عنوان و آمادگی.
 * ایزومورفیک است (بدون server-only)؛ صفحه‌ها، تست‌ها و اسکریپت‌ها از آن استفاده می‌کنند.
 */
import type { GradeKey } from "@/lib/syllabus";
import { GRADE_KEYS, GRADE_SLUG, chapterCount, chapterTitle, faslWord, gradeName, isLive, quizLabel, quizPath } from "@/lib/site-routes";
import type { QuizContent } from "./types";
import g10f1 from "./g10-f1";
import g10f2 from "./g10-f2";
import g10f3 from "./g10-f3";
import g11f1 from "./g11-f1";
import g11f2 from "./g11-f2";
import g11f3 from "./g11-f3";
import g12f1 from "./g12-f1";
import g12f2 from "./g12-f2";
import g12f3 from "./g12-f3";
import g12f4 from "./g12-f4";

export type { OptionIndex, QuizContent, QuizLevel, QuizQuestion } from "./types";

/** آزمون با کمتر از این تعداد سؤال «آماده» نیست و صفحه‌اش ساخته نمی‌شود */
export const MIN_QUESTIONS = 12;
export const MAX_QUESTIONS = 15;

/** هر فصل دقیقاً یک آزمون (به ترتیب پایه و فصل) */
export const QUIZZES: readonly QuizContent[] = [g10f1, g10f2, g10f3, g11f1, g11f2, g11f3, g12f1, g12f2, g12f3, g12f4];

const BY_KEY = new Map(QUIZZES.map((q) => [`${q.grade}-${q.n}`, q]));

/** آزمون یک فصل (یا undefined) */
export const getQuiz = (g: GradeKey, n: number) => BY_KEY.get(`${g}-${n}`);

/** آیا آزمون نوشته شده و قابل انتشار است؟ (stubها سؤال ندارند) */
export const isQuizReady = (q?: QuizContent): q is QuizContent => !!q && q.questions.length >= MIN_QUESTIONS;

/** «dahom-fasl-1» */
export const quizSlug = (g: GradeKey, n: number) => `${GRADE_SLUG[g]}-fasl-${n}`;

/** برای generateStaticParams: فقط آزمون‌های آماده (بقیه با dynamicParams = false ۴۰۴ می‌شوند) */
export const readyQuizParams = () => QUIZZES.filter((q) => isQuizReady(q)).map((q) => ({ slug: quizSlug(q.grade, q.n) }));

/** لینک دادن به صفحه‌ی آزمون امن است؟ هم نوشته شده باشد، هم در SEO_ROUTES live شده باشد */
export const quizLinkable = (g: GradeKey, n: number) => isQuizReady(getQuiz(g, n)) && isLive(quizPath(g, n));

/** عنوان صفحه (حداکثر ۶۰ نویسه): «آزمون آنلاین شیمی دهم فصل اول (تست با پاسخ تشریحی)» */
export const quizTitle = (q: QuizContent) =>
  q.title ?? `آزمون آنلاین شیمی ${gradeName(q.grade)} فصل ${faslWord(q.n)} (تست با پاسخ تشریحی)`;

/** H1: «آزمون آنلاین فصل اول شیمی دهم: کیهان، زادگاه الفبای هستی» */
export const quizHeading = (g: GradeKey, n: number) => `${quizLabel(g, n)}: ${chapterTitle(g, n)}`;

/** زمان پیشنهادی آزمون به دقیقه (یک دقیقه برای هر سؤال) */
export const quizMinutes = (q: QuizContent) => q.questions.length;

/** آزمون بعدی: فصل بعدی همان پایه، وگرنه فصل اول پایه‌ی بعد؛ بعد از آخرین فصل دوازدهم: null */
export function nextQuiz(g: GradeKey, n: number): { g: GradeKey; n: number } | null {
  if (n < chapterCount(g)) return { g, n: n + 1 };
  const i = GRADE_KEYS.indexOf(g);
  return i >= 0 && i < GRADE_KEYS.length - 1 ? { g: GRADE_KEYS[i + 1], n: 1 } : null;
}
