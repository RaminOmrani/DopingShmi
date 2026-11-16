/**
 * نوع داده‌ی متن راهنمای صفحه‌های ابزار (بسته‌ی C2).
 *
 * نحو متن‌ها (Rich): همان نحو <ChemText> — فرمول داخل {{…}}، پررنگ داخل **…** — به‌اضافه‌ی `…` برای متنی که
 * کاربر باید عیناً در ابزار تایپ کند (چپ‌به‌راست و بدون زیروند نمایش داده می‌شود؛ src/components/tools/RichText.tsx).
 * رقم‌های نثر فارسی‌اند؛ رقم لاتین فقط داخل {{…}} و `…` می‌آید.
 */
import type { ToolKey } from "@/lib/site-routes";

/** متن غنی: ChemText + `ورودی تایپی` */
export type Rich = string;

/** مثال حل‌شده */
export interface GuideExample {
  title: string;
  question: Rich;
  steps: Rich[];
  answer: Rich;
  /**
   * برای مثال موازنه: معادله‌ی بدون ضریب و ضریب‌های مورد انتظار. آزمون محتوا آن را با خروجی کتابخانه
   * (balanceEquation) مقایسه می‌کند تا متن و ابزار هرگز با هم اختلاف نداشته باشند.
   */
  check?: { equation: string; coefficients: number[] };
}

/** لینک داخلی به صفحه‌ی بسته‌ی دیگر (با RouteLink؛ اگر live نباشد متن ساده می‌ماند) */
export interface GuideLink {
  path: string;
  /** پیش‌فرض: label همان مسیر در SEO_ROUTES */
  text?: string;
}

export interface GuideSection {
  /** شناسه‌ی لاتین کوچک با خط تیره (لنگر صفحه) */
  id: string;
  heading: Rich;
  paragraphs: Rich[];
  /** فهرست نشانه‌دار (ul) */
  bullets?: Rich[];
  /** فهرست مرحله‌ای (ol) */
  ordered?: Rich[];
  /** معادله‌های سطر جدا (نحو <Eq>) */
  equations?: string[];
  examples?: GuideExample[];
  /** کادر «اشتباه رایج» */
  mistake?: Rich;
  /** کادر «نکته» */
  tip?: Rich;
  /** «مرور کامل در …»: لینک به فصل مرتبط */
  see?: GuideLink[];
}

export interface ToolContent {
  key: Exclude<ToolKey, "formulas">;
  /** عنوان متا (حداکثر ۶۰ نویسه، بدون {{}}) */
  title: string;
  /** توضیح متا (۱۰۰ تا ۱۷۰ نویسه، بدون {{}}) */
  description: string;
  h1: string;
  /** پاراگراف معرفی زیر H1 */
  lead: Rich;
  /** «روش استفاده» در سه گام */
  howTo: [Rich, Rich, Rich];
  /** عنوان بخش راهنما (H2 بالای بخش‌ها) */
  guideTitle: string;
  sections: GuideSection[];
  /** موضوع صفحه برای JSON-LD (about) */
  about: string;
  educationalLevel: string[];
  /** قابلیت‌های ابزار برای featureList در JSON-LD (متن ساده) */
  features: string[];
  /** فقط متنی که خود استاد داده است؛ تا آن زمان خالی (کادر «نکته استاد» پنهان می‌ماند) */
  teacherNotes: Rich[];
  /** فهرست بازبینی برای استاد و بازبین علمی (در صفحه نمایش داده نمی‌شود) */
  review: { verify: string[] };
}
