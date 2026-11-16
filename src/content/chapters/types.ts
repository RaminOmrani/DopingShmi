/**
 * مدل محتوای صفحه‌های فصل (/shimi-dahom/fasl-1 و …). هر فصل یک فایل جدا دارد (g10-f1.ts …) و در index.ts ثبت می‌شود.
 * همه‌ی رشته‌های نوع Rich با ChemText نمایش داده می‌شوند: {{فرمول یا معادله}} و **پررنگ**.
 * راهنمای کامل نوشتن و معیار کیفیت: scratchpad/seo-chapter-guide.md (و validate.ts برای بررسی خودکار).
 */
import type { GradeKey } from "../../lib/syllabus";
import type { ToolKey } from "../../lib/site-routes";

/** متن فارسی با نشانه‌گذاری ChemText؛ فرمول خام (مثل H2O) فقط داخل {{…}} */
export type Rich = string;

/** رابطه‌ی کلیدی یک بخش */
export interface ChapterFormula {
  /** خود رابطه با نشانه‌گذاری Chem (چپ‌به‌راست)، مثل «n = m ÷ M» یا «N = n × N_A» */
  f: string;
  /** معنی نمادها؛ sym هم با Chem نمایش داده می‌شود */
  vars: { sym: string; desc: Rich }[];
  /** توضیح کوتاه یکاها یا شرط استفاده */
  note?: Rich;
}

/** مثال حل‌شده؛ هر عدد دو بار حساب و بررسی شود */
export interface WorkedExample {
  question: Rich;
  steps: Rich[];
  answer: Rich;
}

/** یک زیرفصل (۱۵۰ تا ۲۵۰ کلمه در paragraphs و bullets) */
export interface ChapterSection {
  /** شناسه‌ی لاتین یکتا برای لنگر، مثل "isotope" */
  id: string;
  /** عنوان بخش (اصطلاح کتاب درسی + عبارت جست‌وجو) */
  heading: Rich;
  paragraphs: Rich[];
  bullets?: Rich[];
  /** معادله‌های واکنش، هر کدام یک سطر جدا (Eq) */
  equations?: string[];
  formula?: ChapterFormula;
  example?: WorkedExample;
  /** متن کادر «اشتباه رایج» */
  mistake?: Rich;
}

export type QuestionKind = "تعریف" | "محاسبه" | "چرایی" | "موازنه" | "درست یا نادرست" | "کامل کردنی" | "مقایسه";

/** سؤال تشریحی نمونه‌ی امتحانی (نوشته‌ی خود ما؛ هرگز از کتاب یا ناشران) */
export interface SampleQuestion {
  q: Rich;
  /** پاسخ؛ آرایه = چند بند یا مرحله */
  answer: Rich | Rich[];
  /** id بخشی که سؤال از آن است */
  subtopic: string;
  kind: QuestionKind;
}

/** ویدیوی آپارات (فعلاً خالی؛ فقط با داده‌ی واقعی) */
export interface AparatVideo {
  /** شناسه‌ی ویدیو در نشانی aparat.com/v/<id> */
  id: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  uploadDate: string;
  durationSec: number;
  thumbnailUrl: string;
}

export interface ChapterContent {
  status: "ready";
  grade: GradeKey;
  n: number;
  /** عنوان فصل دقیقاً مطابق syllabus.ts (آخرین چاپ کتاب) */
  title: string;
  /** عنوان سئو، حداکثر ۶۰ نویسه، فصل با حروف (اول/دوم…) */
  metaTitle: string;
  /** ۱۲۰ تا ۱۶۰ نویسه، با نام فصل و «نمونه سوال با جواب» */
  metaDescription: string;
  /** مثل «فصل اول شیمی دهم: کیهان زادگاه عناصر» */
  h1: string;
  /** حداکثر ۱۲۰ کلمه */
  intro: Rich;
  /** ۴ تا ۶ بخش */
  sections: ChapterSection[];
  /** ۵ تا ۸ «نکته‌ی تستی» */
  konkurTips: Rich[];
  /** فقط متنی که خود استاد داده است؛ خالی = کادر «نکته استاد» پنهان */
  teacherNotes: Rich[];
  /** ۸ تا ۱۰ سؤال تشریحی با پاسخ */
  sampleQuestions: SampleQuestion[];
  relatedTools: ToolKey[];
  /** لینک‌های مرتبط دیگر (مسیر داخلی؛ غیر live خودکار پنهان می‌شود) */
  related?: { path: string; label?: string; desc?: string }[];
  aparat?: AparatVideo;
  /** برای استاد و بازبین علمی؛ در صفحه نمایش داده نمی‌شود */
  review: {
    /** نکته‌های وابسته به چاپ کتاب که استاد باید تأیید کند */
    verify: string[];
    /** ۲ تا ۳ پرسش برای گرفتن «نکته استاد» */
    teacherPrompts: string[];
  };
}

/** جای خالی فصلی که هنوز نوشته نشده (صفحه‌اش ۴۰۴ می‌دهد) */
export interface ChapterStub {
  status: "stub";
  grade: GradeKey;
  n: number;
}

export type ChapterEntry = ChapterContent | ChapterStub;

/** تعریف محتوای یک فصل آماده */
export const defineChapter = (c: Omit<ChapterContent, "status">): ChapterContent => ({ status: "ready", ...c });

/** جای خالی فصل؛ نویسنده‌ی فصل همین export پیش‌فرض را با defineChapter({...}) جایگزین می‌کند */
export const chapterStub = (grade: GradeKey, n: number): ChapterStub => ({ status: "stub", grade, n });
