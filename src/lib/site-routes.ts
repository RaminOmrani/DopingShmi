/**
 * فهرست مرکزی صفحه‌های عمومی سایت برای سئو، منو، نقشه‌ی سایت و لینک‌دهی داخلی.
 * ایزومورفیک است (بدون server-only): هم در سرور، هم در کامپوننت کلاینت و هم در اسکریپت‌ها (seo-check) قابل import است.
 *
 * قانون: صفحه‌ای که `live: false` است نه در نقشه‌ی سایت می‌آید، نه در منو، و `RouteLink` به آن لینک نمی‌دهد
 * (متن ساده نمایش می‌دهد)؛ `pageMeta` هم آن را خودکار noindex می‌کند (صفحه ساخته می‌شود و ۲۰۰ می‌دهد ولی دیده نمی‌شود).
 * فقط مرحله‌ی یکپارچه‌سازی، پس از بازبینی علمی و گذر از `pnpm seo:check`، `live` را true می‌کند (فهرست HOLD_BACK پایین).
 * `teacherReviewed` فقط وقتی true می‌شود که استاد خودش صفحه را خوانده باشد (روی امضای صفحه و author در JSON-LD اثر دارد).
 * هر بار متن صفحه‌ای واقعاً عوض شد، `updated` همان صفحه را هم به‌روز کنید (lastmod نقشه‌ی سایت و تاریخ امضا).
 */
import { GRADE_PAGES, type GradeKey } from "./syllabus";

/** نام برند برای مسیر راهنما (breadcrumb) و پیش‌فرض‌ها */
export const BRAND = "دوپینگ شیمی";
/** مدرک استاد؛ همیشه دقیقاً همین متن (هرگز «لیسانس») */
export const TEACHER_CREDENTIAL = "کارشناسی ارشد مهندسی شیمی، دانشگاه فردوسی مشهد";
/** شناسه‌ی بخش «روش تهیه و بازبینی محتوا» در صفحه‌ی استاد (بسته‌ی E همین id را روی آن بخش می‌گذارد) */
export const EDITORIAL_ANCHOR = "content-policy";
export const EDITORIAL_PATH = `/javad-partovi#${EDITORIAL_ANCHOR}`;

export type RouteGroup = "core" | "grade" | "chapter" | "quiz" | "tool" | "reference" | "konkur" | "local";
export type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SeoRoute {
  /** مسیر بدون اسلش پایانی، مثل /shimi-dahom/fasl-1 */
  path: string;
  /** متن لنگر لینک‌های داخلی، مثل «فصل اول شیمی دهم» */
  label: string;
  group: RouteGroup;
  /** فقط صفحه‌های live در نقشه‌ی سایت، منو و لینک‌ها می‌آیند */
  live: boolean;
  /** تاریخ آخرین تغییر واقعی محتوا (YYYY-MM-DD)؛ lastmod نقشه‌ی سایت و dateModified در JSON-LD */
  updated: string;
  /** تاریخ اولین انتشار (YYYY-MM-DD)؛ برای صفحه‌های جدید هنگام live شدن پر می‌شود */
  published?: string;
  priority: number;
  changeFrequency: ChangeFrequency;
  /** آیا استاد متن را خوانده و تأیید کرده است؟ (امضای صفحه و author در JSON-LD) */
  teacherReviewed: boolean;
  /** متن کوتاه در مسیر راهنما (پیش‌فرض: label) */
  crumb?: string;
  /** صفحه‌ی والد در مسیر راهنما (پیش‌فرض: صفحه‌ی اصلی) */
  parent?: string;
  /** پایه و شماره‌ی فصل برای صفحه‌های فصل و آزمون */
  grade?: GradeKey;
  n?: number;
  /** موج انتشار طبق برنامه‌ی سئو */
  wave?: 1 | 2;
}

/** تکه‌ی مسیر راهنما (هم برای نمایش، هم برای BreadcrumbList در JSON-LD) */
export interface Crumb {
  name: string;
  path: string;
}

export const GRADE_SLUG = { G10: "dahom", G11: "yazdahom", G12: "davazdahom" } as const satisfies Record<GradeKey, string>;
export type GradeSlug = (typeof GRADE_SLUG)[GradeKey];
export const GRADE_KEYS: GradeKey[] = ["G10", "G11", "G12"];

/** شماره‌ی فصل به حروف: FASL_WORD[n - 1] */
export const FASL_WORD = ["اول", "دوم", "سوم", "چهارم"] as const;
export const faslWord = (n: number) => FASL_WORD[n - 1] ?? String(n);

/** تعداد فصل‌های هر پایه (از syllabus.ts) */
export const chapterCount = (g: GradeKey) => GRADE_PAGES[g].chapters.length;
/** نام پایه، مثل «دهم» */
export const gradeName = (g: GradeKey) => GRADE_PAGES[g].name;
/** عنوان کتاب درسی فصل، مثل «کیهان زادگاه عناصر» */
export const chapterTitle = (g: GradeKey, n: number) => GRADE_PAGES[g].chapters[n - 1]?.title ?? "";

/** /shimi-dahom/fasl-1 */
export const chapterPath = (g: GradeKey, n: number) => `${GRADE_PAGES[g].path}/fasl-${n}`;
export const QUIZ_HUB = "/azmoon-shimi";
/** /azmoon-shimi/dahom-fasl-1 */
export const quizPath = (g: GradeKey, n: number) => `${QUIZ_HUB}/${GRADE_SLUG[g]}-fasl-${n}`;

/** «فصل اول شیمی دهم» */
export const chapterLabel = (g: GradeKey, n: number) => `فصل ${faslWord(n)} شیمی ${gradeName(g)}`;
/** «آزمون آنلاین فصل اول شیمی دهم» */
export const quizLabel = (g: GradeKey, n: number) => `آزمون آنلاین فصل ${faslWord(n)} شیمی ${gradeName(g)}`;

export const TOOL_PATHS = {
  periodic: "/jadval-tanavobi",
  molarMass: "/mohasebe-jerm-moli",
  balance: "/movazene-vakonesh",
  ph: "/mohasebe-ph",
  formulas: "/formul-shimi",
} as const;
export type ToolKey = keyof typeof TOOL_PATHS;

/** تاریخ انتشار صفحه‌های تازه‌ی سئو (یکپارچه‌سازی موج ۱ و ۲: ۲۵ آبان ۱۴۰۵) و بازنویسی صفحه‌های موجود */
const LAUNCH_DATE = "2026-11-16";

/**
 * صفحه‌های برنامه‌ریزی‌شده‌ای که هنوز live نمی‌شوند (noindex، بیرون از نقشه‌ی سایت و منو، بدون لینک داخلی).
 * دلیل هر مورد را کنارش بنویسید. یکپارچه‌سازی ۱۴۰۵/۰۸/۲۵: همه‌ی ۲۶ صفحه بازبینی علمی و seo:check را گذراندند،
 * پس فهرست خالی است.
 */
const HOLD_BACK = new Set<string>([]);

/** صفحه‌های موجود (published از git log فایل همان صفحه؛ updated = آخرین بازنویسی واقعی) */
const EXISTING: SeoRoute[] = [
  { path: "/", label: BRAND, group: "core", live: true, updated: LAUNCH_DATE, published: "2026-09-27", priority: 1, changeFrequency: "weekly", teacherReviewed: false },
  { path: "/javad-partovi", label: "استاد جواد پرتویی", group: "core", live: true, updated: LAUNCH_DATE, published: "2026-09-29", priority: 0.95, changeFrequency: "monthly", teacherReviewed: false },
  { path: "/tadris-shimi", label: "کلاس خصوصی شیمی در مشهد", crumb: "کلاس خصوصی شیمی", group: "local", live: true, updated: LAUNCH_DATE, published: "2026-09-29", priority: 0.9, changeFrequency: "monthly", teacherReviewed: false },
  { path: "/shimi-konkur", label: "شیمی کنکور", group: "konkur", live: true, updated: LAUNCH_DATE, published: "2026-10-03", priority: 0.9, changeFrequency: "monthly", teacherReviewed: false },
  ...GRADE_KEYS.map((g): SeoRoute => ({
    path: GRADE_PAGES[g].path, label: `شیمی ${gradeName(g)}`, group: "grade", grade: g,
    live: true, updated: LAUNCH_DATE, published: "2026-10-03", priority: 0.85, changeFrequency: "monthly", teacherReviewed: false,
  })),
  { path: "/courses", label: "ویدیوهای آموزش شیمی", crumb: "ویدیوهای آموزشی", group: "core", live: true, updated: LAUNCH_DATE, published: "2026-09-27", priority: 0.85, changeFrequency: "weekly", teacherReviewed: false },
  { path: "/articles", label: "مقاله‌های آموزشی شیمی", crumb: "مقالات", group: "core", live: true, updated: LAUNCH_DATE, published: "2026-09-29", priority: 0.8, changeFrequency: "weekly", teacherReviewed: false },
  { path: "/gallery", label: "گالری همایش‌ها", group: "core", live: true, updated: LAUNCH_DATE, published: "2026-09-27", priority: 0.6, changeFrequency: "monthly", teacherReviewed: false },
];

const planned = (r: Omit<SeoRoute, "live" | "updated" | "teacherReviewed" | "changeFrequency"> & Partial<Pick<SeoRoute, "changeFrequency">>): SeoRoute => ({
  changeFrequency: "monthly",
  ...r,
  live: !HOLD_BACK.has(r.path),
  updated: LAUNCH_DATE,
  published: LAUNCH_DATE,
  teacherReviewed: false,
});

/** ۲۶ صفحه‌ی برنامه‌ریزی‌شده (live مگر در HOLD_BACK؛ teacherReviewed تا خواندن استاد false) */
const PLANNED: SeoRoute[] = [
  // ۱۰ صفحه‌ی فصل (بسته‌ی B)
  ...GRADE_KEYS.flatMap((g) =>
    Array.from({ length: chapterCount(g) }, (_, i) => {
      const n = i + 1;
      return planned({
        path: chapterPath(g, n), label: chapterLabel(g, n), crumb: `فصل ${faslWord(n)}`, parent: GRADE_PAGES[g].path,
        group: "chapter", grade: g, n, priority: 0.8, wave: n <= 2 ? 1 : 2,
      });
    }),
  ),
  // هاب آزمون و ۱۰ آزمون فصل (بسته‌ی D)
  planned({ path: QUIZ_HUB, label: "آزمون آنلاین شیمی", group: "quiz", priority: 0.75, wave: 1, changeFrequency: "weekly" }),
  ...GRADE_KEYS.flatMap((g) =>
    Array.from({ length: chapterCount(g) }, (_, i) => {
      const n = i + 1;
      return planned({
        path: quizPath(g, n), label: quizLabel(g, n), crumb: `شیمی ${gradeName(g)} فصل ${faslWord(n)}`, parent: QUIZ_HUB,
        group: "quiz", grade: g, n, priority: 0.7, wave: n <= 2 ? 1 : 2,
      });
    }),
  ),
  // ابزارها (بسته‌ی C) و برگه‌ی فرمول (بسته‌ی E)
  planned({ path: TOOL_PATHS.molarMass, label: "محاسبه جرم مولی", group: "tool", priority: 0.8, wave: 1 }),
  planned({ path: TOOL_PATHS.balance, label: "موازنه واکنش", group: "tool", priority: 0.8, wave: 1 }),
  planned({ path: TOOL_PATHS.ph, label: "محاسبه pH", group: "tool", priority: 0.8, wave: 1 }),
  planned({ path: TOOL_PATHS.periodic, label: "جدول تناوبی", group: "tool", priority: 0.8, wave: 2 }),
  planned({ path: TOOL_PATHS.formulas, label: "فرمول‌های شیمی", group: "reference", priority: 0.8, wave: 1 }),
];

export const SEO_ROUTES: readonly SeoRoute[] = [...EXISTING, ...PLANNED];

const BY_PATH = new Map(SEO_ROUTES.map((r) => [r.path, r]));

/** مسیر را یکدست می‌کند: بدون دامنه، کوئری، هش و اسلش پایانی؛ رمزگشایی‌شده */
export function normalizePath(path: string): string {
  let p = path.trim().replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0] || "/";
  try {
    p = decodeURI(p);
  } catch {
    /* مسیر نامعتبر؛ همان‌طور بماند */
  }
  if (!p.startsWith("/")) p = `/${p}`;
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/** رکورد یک مسیر ثبت‌شده (یا undefined) */
export const route = (path: string): SeoRoute | undefined => BY_PATH.get(normalizePath(path));

/** متن لنگر ثبت‌شده‌ی یک مسیر */
export const label = (path: string): string | undefined => route(path)?.label;

/** فضای نام صفحه‌های برنامه‌ریزی‌شده: زیرمسیر ثبت‌نشده در این فضا (مثل /shimi-dahom/fasl-4) وجود ندارد */
const PLANNED_SPACE = /^\/(azmoon-shimi(\/|$)|shimi-(dahom|yazdahom|davazdahom)\/)/;

/**
 * آیا لینک دادن به این مسیر امن است؟
 * مسیر ثبت‌شده: مقدار live. مسیر ثبت‌نشده: true (مقاله‌ها، مباحث /courses/<id>، /login و لینک بیرونی)،
 * مگر در فضای نام صفحه‌های برنامه‌ریزی‌شده.
 */
export function isLive(path: string): boolean {
  if (/^(https?:|mailto:|tel:)/i.test(path)) return true;
  const p = normalizePath(path);
  const r = BY_PATH.get(p);
  if (r) return r.live;
  return !PLANNED_SPACE.test(p);
}

/** صفحه‌های live (برای نقشه‌ی سایت و منو) */
export const liveRoutes = (group?: RouteGroup) => SEO_ROUTES.filter((r) => r.live && (!group || r.group === group));

/** همه‌ی صفحه‌های یک گروه (اختیاری: فقط live) */
export const routesOf = (group: RouteGroup, opts: { liveOnly?: boolean } = {}) =>
  SEO_ROUTES.filter((r) => r.group === group && (!opts.liveOnly || r.live));

/**
 * مسیر راهنمای کامل یک صفحه از روی parent‌ها: [دوپینگ شیمی، …، خود صفحه].
 * والد میانیِ غیر live حذف می‌شود تا هیچ لینکی (در صفحه یا JSON-LD) به صفحه‌ی ناموجود نرود.
 */
export function crumbsFor(path: string): Crumb[] {
  const self = route(path);
  if (!self) return [{ name: BRAND, path: "/" }];
  if (self.path === "/") return [{ name: BRAND, path: "/" }];
  const chain: Crumb[] = [{ name: self.crumb ?? self.label, path: self.path }];
  const seen = new Set([self.path]);
  let parent = self.parent;
  while (parent && parent !== "/" && !seen.has(parent)) {
    seen.add(parent);
    const r = BY_PATH.get(parent);
    if (!r) break;
    if (r.live) chain.unshift({ name: r.crumb ?? r.label, path: r.path });
    parent = r.parent;
  }
  return [{ name: BRAND, path: "/" }, ...chain];
}

/** «fasl-2» → 2 ؛ نامعتبر → null */
export function parseFasl(slug: string, g?: GradeKey): number | null {
  const m = /^fasl-(\d)$/.exec(slug);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= (g ? chapterCount(g) : 4) ? n : null;
}

/** «yazdahom-fasl-2» → { g: "G11", n: 2 } ؛ نامعتبر → null */
export function parseQuizSlug(slug: string): { g: GradeKey; n: number } | null {
  const m = /^(dahom|yazdahom|davazdahom)-fasl-(\d)$/.exec(slug);
  if (!m) return null;
  const g = GRADE_KEYS.find((k) => GRADE_SLUG[k] === m[1])!;
  const n = parseFasl(`fasl-${m[2]}`, g);
  return n ? { g, n } : null;
}

/** برای generateStaticParams صفحه‌ی [fasl] هر پایه: [{ fasl: "fasl-1" }, …] */
export const chapterParams = (g: GradeKey) => Array.from({ length: chapterCount(g) }, (_, i) => ({ fasl: `fasl-${i + 1}` }));

/** برای generateStaticParams صفحه‌ی /azmoon-shimi/[slug]: [{ slug: "dahom-fasl-1" }, …] */
export const quizParams = () =>
  GRADE_KEYS.flatMap((g) => Array.from({ length: chapterCount(g) }, (_, i) => ({ slug: `${GRADE_SLUG[g]}-fasl-${i + 1}` })));
