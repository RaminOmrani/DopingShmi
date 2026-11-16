/**
 * قالب داده‌ی آزمون‌های آنلاین رایگان فصل‌به‌فصل (/azmoon-shimi/<پایه>-fasl-<N>).
 * هر فصل یک فایل دارد (g10-f1.ts …) و در index.ts ثبت می‌شود. راهنمای نوشتن و معیار کیفیت: seo-quiz-guide.md
 *
 * نشانه‌گذاری متن‌ها (text، given، options، explanation، intro، teacherNote):
 * - {{…}} فرمول یا معادله‌ی شیمیایی (ChemText): {{H2SO4}}، {{Fe^3+}}، {{^{37}Cl}}، {{_{26}Fe}}، {{3d^6}}
 * - [[…]] محاسبه‌ی چپ‌به‌راست با رقم فارسی: [[۹ ÷ ۱۸ = ۰٫۵]]، [[۶٫۰۲ × ۱۰^۲۳]]
 * - **…** پررنگ (داخل آن [[…]] نگذارید)
 */
import type { GradeKey } from "@/lib/syllabus";

export type QuizLevel = "آسان" | "متوسط" | "دشوار";
export type OptionIndex = 0 | 1 | 2 | 3;

export interface QuizQuestion {
  /** شناسه‌ی پایدار و یکتا در کل سایت، مثل «g10-f1-q01» (نام گروه رادیویی و کلید ذخیره) */
  id: string;
  /** صورت سؤال */
  text: string;
  /** داده‌های لازم برای حل (جرم مولی، عدد آووگادرو…)؛ زیر صورت سؤال نمایش داده می‌شود */
  given?: string;
  /** دقیقاً چهار گزینه، به همان ترتیبی که نمایش داده می‌شود (گزینه‌ها جابه‌جا نمی‌شوند) */
  options: readonly [string, string, string, string];
  /** شماره‌ی گزینه‌ی درست از صفر (۰ = گزینه‌ی ۱) */
  correct: OptionIndex;
  /** پاسخ تشریحی ۲ تا ۴ جمله؛ به شماره‌ی گزینه‌ها ارجاع ندهید */
  explanation: string;
  /** دقیقاً یکی از topics همان فصل در src/lib/syllabus.ts */
  subtopic: string;
  level: QuizLevel;
  /** سؤال محاسباتی است؟ (برای شمارش حداقل سؤال‌های محاسباتی) */
  calc?: boolean;
}

export interface QuizContent {
  grade: GradeKey;
  /** شماره‌ی فصل (۱ تا ۴) */
  n: number;
  /** توضیح متا، ۱۰۰ تا ۱۷۰ نویسه، یکتا */
  description: string;
  /** مقدمه‌ی یکتای صفحه (۱۰۰ تا ۱۵۰ واژه)؛ هر عضو یک بند */
  intro: string[];
  /** ۱۲ تا ۱۵ سؤال؛ آرایه‌ی خالی یعنی آزمون هنوز آماده نیست (صفحه ساخته نمی‌شود) */
  questions: QuizQuestion[];
  /** مسیرهای مرتبط برای بخش «بعد از آزمون» (مثل TOOL_PATHS.molarMass)؛ صفحه‌های غیر live خودکار حذف می‌شوند */
  related?: string[];
  /** «نکته استاد»: فقط متنی که خود استاد داده است؛ خالی → کادر نمایش داده نمی‌شود */
  teacherNote?: string;
  /** عنوان سفارشی صفحه (حداکثر ۶۰ نویسه)؛ پیش‌فرض: الگوی quizTitle در index.ts */
  title?: string;
}
