import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, BookOpen, BookOpenCheck, Calculator, ChevronDown, ChevronLeft, ExternalLink, FlaskConical, Layers, LineChart, Phone, Target, Timer,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { canonicalUrl, eduGraph, itemListLd, pageMeta } from "@/lib/page-meta";
import { ldRef } from "@/lib/seo";
import { GRADE_LIST, type GradeKey } from "@/lib/syllabus";
import { QUIZ_HUB, TOOL_PATHS, chapterLabel, chapterPath, crumbsFor, faslWord, isLive, quizLabel, quizPath } from "@/lib/site-routes";
import { JsonLd } from "@/components/JsonLd";
import { ChemText } from "@/components/seo/Chem";
import { Breadcrumbs, Byline, RelatedLinks, RouteLink } from "@/components/seo/EduChrome";
import { cn, faNum } from "@/lib/utils";

export const revalidate = 300;

/** سال کنکوری که این صفحه برایش نوشته شده است؛ هر سال پس از کنکور (تابستان) یکی اضافه شود */
const KONKUR_YEAR = 1406;
const PATH = "/shimi-konkur";
const TITLE = `شیمی کنکور ${faNum(KONKUR_YEAR)}: سرفصل‌ها، روش مطالعه و تست | دوپینگ شیمی`;
const DESCRIPTION = `شیمی کنکور ${faNum(KONKUR_YEAR)} از دهم تا دوازدهم: نقشه‌ی ده فصل سه کتاب، فصل‌های محاسباتی و مفهومی، مسیر مطالعه‌ی چهارمرحله‌ای، اشتباه‌های رایج و پرسش‌های پرتکرار.`;
/** مقاله‌های پشتیبان (پیش‌نویس‌های seed؛ فقط وقتی منتشر شده باشند پیوند داده می‌شوند). نشانی فارسی، اسلاگ قدیمی همان مقاله است */
const METHOD_SLUGS = ["ravesh-motalee-shimi-konkur", "روش-مطالعه-شیمی-کنکور"];
const FROM_ZERO_SLUG = "shimi-konkur-az-sefr";

type Kind = "calc" | "mixed" | "concept";
const KIND: Record<Kind, { label: string; cls: string }> = {
  calc: { label: "محاسبه‌محور", cls: "border-cyan/30 bg-cyan/10 text-cyan" },
  mixed: { label: "ترکیبی", cls: "border-violet/30 bg-violet/10 text-violet" },
  concept: { label: "مفهومی و حفظی", cls: "border-amber/30 bg-amber/10 text-amber" },
};

/**
 * نوع غالب هر فصل و مهارت اصلی آن برای تست (کیفی؛ بدون درصد و تعداد سؤال).
 * ترتیب آرایه‌ها همان ترتیب فصل‌ها در syllabus.ts است.
 */
const CHAPTER_NOTES: Record<GradeKey, { kind: Kind; note: string }[]> = {
  G10: [
    { kind: "mixed", note: "محاسبه‌ی جرم اتمی میانگین و مول در کنار مفهوم‌های ساختار اتم، طیف نشری خطی و آرایش الکترونی. آرایش الکترونی پایه‌ی جدول دوره‌ای و بسیاری از فصل‌های بعدی است." },
    { kind: "mixed", note: "موازنه به روش وارسی، حجم مولی و استوکیومتری گازها در کنار مطالب توصیفی هواکره، اکسیدها، ساختار لوویس و اثر گلخانه‌ای. بخش محاسباتی این فصل سنگین است." },
    { kind: "mixed", note: "غلظت (درصد جرمی، ppm و غلظت مولار) و نمودار انحلال‌پذیری محاسبه می‌خواهند؛ قطبیت، نیروهای بین‌مولکولی و پیوند هیدروژنی مفهومی‌اند." },
  ],
  G11: [
    { kind: "mixed", note: "درصد خلوص و بازده درصدی در استوکیومتری، کنار روندهای تناوبی، عنصرهای دسته‌ی {{d}} و نام‌گذاری هیدروکربن‌ها." },
    { kind: "calc", note: "گرما و ظرفیت گرمایی، آنتالپی پیوند، قانون هس و سرعت متوسط واکنش؛ بیشتر بخش‌های این فصل با مسئله همراه است." },
    { kind: "concept", note: "پلیمرها، تشخیص مونومر از روی ساختار، گروه‌های عاملی و واکنش استری شدن؛ بیشتر به شناخت ساختار و دقت در متن کتاب نیاز دارد." },
  ],
  G12: [
    { kind: "mixed", note: "محاسبه‌ی pH، ثابت یونش و درجه‌ی یونش در کنار مطالب مفهومی پاک‌کننده‌ها و مدل آرنیوس برای اسیدها و بازها." },
    { kind: "mixed", note: "اکسایش و کاهش، سلول گالوانی و الکترولیتی و خوردگی را باید فهمید؛ محاسبه‌ی emf و تعیین عدد اکسایش بخش محاسباتی آن است." },
    { kind: "concept", note: "دسته‌بندی جامدها، قطبیت مولکول‌ها، آنتالپی فروپاشی شبکه و مدل دریای الکترونی؛ مهم‌ترین مهارت آن مقایسه و استدلال درباره‌ی خواص مواد است." },
    { kind: "mixed", note: "ثابت تعادل و محاسبه‌ی آن، کنار اصل لوشاتلیه، نقش کاتالیزگر و انرژی فعال‌سازی و سنتز مولکول‌های آلی." },
  ],
};

const STUDY_TYPES: { kind: Kind; icon: typeof Calculator; text: string }[] = [
  {
    kind: "calc",
    icon: Calculator,
    text: "فصل دوم یازدهم (گرماشیمی و سرعت واکنش) از محاسباتی‌ترین فصل‌هاست و بخش‌های محاسباتی فصل دوم دهم، فصل اول یازدهم و فصل‌های اول و چهارم دوازدهم هم کم نیستند. همه‌ی این محاسبه‌ها روی یک پایه ساخته می‌شوند: مول و عامل تبدیل در دهم. روش مطالعه: هر روز چند مسئله‌ی کوتاه، نوشتن یکا در هر مرحله و تمرین بدون ماشین‌حساب.",
  },
  {
    kind: "concept",
    icon: BookOpen,
    text: "فصل سوم یازدهم (پلیمرها و گروه‌های عاملی) و فصل سوم دوازدهم (ساختار و رفتار جامدها) بیشتر به فهم ساختار، مقایسه‌ی خواص و دقت در متن کتاب تکیه دارند. روش مطالعه: خواندن چندباره‌ی متن کتاب، ساختن جدول‌های مقایسه‌ای به خط خودتان و مرور با فاصله‌های افزایشی، مثلاً یک روز، یک هفته و یک ماه بعد.",
  },
  {
    kind: "mixed",
    icon: Layers,
    text: "بقیه‌ی فصل‌ها، از آرایش الکترونی و استوکیومتری دهم تا الکتروشیمی دوازدهم، هر دو جنس را دارند. در این فصل‌ها بخش محاسباتی و بخش توصیفی را جدا برنامه‌ریزی کنید تا یکی فدای دیگری نشود؛ مثلاً در فصل دوم دوازدهم، محاسبه‌ی emf کوتاه است ولی پیش‌بینی جهت واکنش و فهم کار سلول‌ها تمرین مفهومی می‌خواهد.",
  },
];

const STEPS = [
  { icon: BookOpenCheck, t: "پایه‌سازی مفهومی", d: "هر فصل را از روی کتاب درسی و یک درسنامه‌ی مفهومی بخوانید تا «چرا»ی هر نکته را بدانید. در این مرحله سرعت مهم نیست؛ مهم این است که بتوانید هر مفهوم را با زبان خودتان توضیح دهید." },
  { icon: Target, t: "تست آموزشی و مبحثی", d: "بعد از هر درسنامه تست آموزشی بدون محدودیت زمان بزنید و پاسخ تشریحی را با دقت بخوانید. در پایان هر فصل، یک آزمون مبحثی زمان‌دار بدهید." },
  { icon: Timer, t: "آزمون جامع زمان‌دار", d: "وقتی چند فصل را تمام کردید، آزمون‌های جامع زمان‌دار را شروع کنید تا مدیریت زمان، ترتیب پاسخ دادن و رها کردن سؤال وقت‌گیر را تمرین کنید." },
  { icon: LineChart, t: "تحلیل و جمع‌بندی", d: "اشتباه‌ها را دسته‌بندی کنید (مفهومی، بی‌دقتی، کمبود وقت، حفظی) و در جمع‌بندی پایانی بیشترین وقت را به پرتکرارترین دسته بدهید." },
];

const MISTAKES: { t: string; d: string }[] = [
  { t: "تست زدن پیش از فهم درسنامه", d: "تستی که بدون فهم مفهوم زده شود، با کمی تغییر در صورت سؤال از دست می‌رود." },
  { t: "نادیده گرفتن متن، جدول‌ها و شکل‌های کتاب درسی", d: "بسیاری از سؤال‌های حفظی و مفهومی به همین بخش‌های کتاب برمی‌گردند، نه به خلاصه‌ها." },
  { t: "جا انداختن یکا در استوکیومتری", d: "در زنجیره‌ی عامل‌های تبدیل، یکا را در هر مرحله بنویسید؛ ساده شدن یکاها نشان می‌دهد مسیر حل درست است." },
  { t: "نسبت مولی از معادله‌ی موازنه‌نشده", d: "نسبت مولی را فقط از ضریب‌های معادله‌ی موازنه‌شده بخوانید؛ مثلاً در {{N2 + 3H2 -> 2NH3}} به ازای هر سه مول {{H2}}، دو مول {{NH3}} تولید می‌شود." },
  { t: "قاطی کردن اتم و مولکول", d: "یک مول {{O2}} دو مول اتم اکسیژن دارد؛ در مسئله‌های شمارش ذره، اول روشن کنید اتم را می‌شمارید یا مولکول را." },
  { t: "علامت {{ΔH}} در قانون هس", d: "وقتی معادله‌ای را وارونه می‌کنید، علامت {{ΔH}} آن عوض می‌شود و وقتی آن را در عددی ضرب می‌کنید، {{ΔH}} هم در همان عدد ضرب می‌شود." },
  { t: "یکی گرفتن قدرت اسید و غلظت آن", d: "قدرت اسید به میزان یونش آن در آب برمی‌گردد، نه به غلظتش؛ محلول رقیق یک اسید قوی می‌تواند pH کمتری از محلول غلیظ‌تر یک اسید ضعیف داشته باشد." },
  { t: "آزمون دادن بدون تحلیل", d: "آزمونی که تحلیل نشود فقط یک عدد می‌سازد؛ علت هر تست غلط یا نزده را یادداشت کنید." },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "شیمی کنکور تجربی و ریاضی چه فرقی دارد؟",
    a: "منبع شیمی در هر دو گروه همان سه کتاب شیمی دهم، یازدهم و دوازدهم است و این کتاب‌ها برای دو رشته یکسان‌اند. تعداد سؤال، زمان پاسخ‌گویی و ضریب شیمی در هر گروه را سازمان سنجش در دفترچه‌ی راهنمای همان سال اعلام می‌کند؛ پس روش مطالعه یکی است و فقط سهم زمانی شیمی در برنامه‌ی شما بر اساس ضریب گروهتان فرق می‌کند.",
  },
  {
    q: "شیمی کنکور را از کجا شروع کنیم؟",
    a: "اگر پایه‌ی ضعیفی دارید از شیمی دهم شروع کنید، چون مول، آرایش الکترونی، موازنه و استوکیومتری در هر سه کتاب تکرار می‌شوند. فصل‌های اول و دوم دهم را پیش از هر چیز محکم کنید و هم‌زمان شیمی پایه‌ی جاری را عقب نیندازید؛ دانش‌آموز دوازدهم نباید درس مدرسه را فدای مرور دهم کند.",
  },
  {
    q: "برای شیمی کنکور اول درسنامه بخوانیم یا تست بزنیم؟",
    a: "هر دو، به ترتیب: اول درسنامه و فهم مفهوم، بعد تست آموزشی، سپس تست مبحثی و آزمون جامع زمان‌دار. تست بدون مفهوم با کمی تغییر صورت سؤال در کنکور جواب نمی‌دهد. تعداد تست مهم است، اما کیفیت تحلیل بعد از هر آزمون از آن مهم‌تر است.",
  },
  {
    q: "حفظیات شیمی کنکور را چطور بخوانیم؟",
    a: "حفظیات شیمی از جمله‌ها، جدول‌ها، شکل‌ها و بخش‌هایی مثل «خود را بیازمایید» و «با هم بیندیشیم» در کتاب درسی می‌آید. به‌جای حفظ پراکنده، برای هر فصل یک برگه‌ی خلاصه با جدول‌های مقایسه‌ای خودتان بسازید و آن را با فاصله‌های افزایشی مرور کنید. حفظی که با دلیل همراه باشد دیرتر فراموش می‌شود؛ اگر بدانید چرا نقطه‌ی جوش {{H2O}} از {{H2S}} بسیار بالاتر است (پیوند هیدروژنی)، دیگر لازم نیست آن را جدا حفظ کنید.",
  },
  {
    q: "در کنکور ماشین‌حساب نداریم؛ محاسبه‌های شیمی را چطور سریع کنیم؟",
    a: "استفاده از ماشین‌حساب در جلسه‌ی کنکور مجاز نیست، پس محاسبه‌ی ذهنی را از همان دهم تمرین کنید. در زنجیره‌ی عامل‌های تبدیل، پیش از ضرب کردن، عددها را ساده کنید، با نماد علمی و توان‌های ده کار کنید و وقتی گزینه‌ها از هم دورند، تقریب بزنید. نوشتن یکا در هر مرحله هم جلوی وارونه نوشتن کسرها را می‌گیرد.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ title: TITLE, description: DESCRIPTION, path: PATH });
}

export default async function KonkurPage() {
  const [s, articles] = await Promise.all([
    getSetting("site"),
    db.article
      .findMany({ where: { published: true, slug: { in: [...METHOD_SLUGS, FROM_ZERO_SLUG] } }, select: { slug: true, title: true } })
      .catch(() => []),
  ]);
  const method = METHOD_SLUGS.map((slug) => articles.find((a) => a.slug === slug)).find(Boolean);
  const fromZero = articles.find((a) => a.slug === FROM_ZERO_SLUG);
  const city = s.city || "مشهد";
  const crumbs = crumbsFor(PATH);

  // فهرست ساختاریافته: صفحه‌های فصل که live شده‌اند؛ تا آن زمان سه صفحه‌ی پایه
  const liveChapters = GRADE_LIST.flatMap((g) => g.chapters.map((_, i) => ({ name: chapterLabel(g.key, i + 1), path: chapterPath(g.key, i + 1) }))).filter((c) => isLive(c.path));
  const listItems = liveChapters.length ? liveChapters : GRADE_LIST.map((g) => ({ name: `شیمی ${g.name}`, path: g.path }));
  const listId = `${canonicalUrl(PATH)}#chapters`;
  const ld = eduGraph(s, {
    path: PATH,
    title: "شیمی کنکور: نقشه‌ی راه از دهم تا دوازدهم",
    description: DESCRIPTION,
    type: "CollectionPage",
    breadcrumb: crumbs,
    educationalLevel: ["پایه‌ی دهم", "پایه‌ی یازدهم", "پایه‌ی دوازدهم", "داوطلبان کنکور سراسری"],
    about: ["شیمی کنکور", "کنکور سراسری"],
    teaches: GRADE_LIST.flatMap((g) => g.chapters.map((c) => c.title)),
    extra: { mainEntity: ldRef(listId) },
    nodes: [itemListLd(liveChapters.length ? "فصل‌های شیمی کنکور" : "کتاب‌های شیمی کنکور", listItems, listId)],
  });

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <p className="mb-3 text-sm font-bold text-cyan">شیمی کنکور {faNum(KONKUR_YEAR)} · تجربی و ریاضی</p>
      <h1 className="section-title mb-4">
        <span className="text-gradient">شیمی کنکور</span>: نقشه‌ی راه از دهم تا دوازدهم
      </h1>
      <Byline s={s} path={PATH} />
      <p className="mb-4 max-w-3xl leading-9 text-white/75">
        شیمی کنکور ترکیبی از مفهوم، حفظیات کتاب درسی و مسئله‌های محاسباتی است و با برنامه‌ی درست، یکی از قابل‌پیش‌بینی‌ترین درس‌های کنکور می‌شود. این صفحه
        نقشه‌ی راه شیمی کنکور {faNum(KONKUR_YEAR)} است: سؤال‌ها از کدام کتاب‌ها می‌آیند، ده فصل این سه کتاب هر کدام چه مهارتی می‌خواهند، کدام فصل‌ها
        محاسباتی‌اند و کدام مفهومی، و مطالعه را با چه ترتیبی جلو ببرید. این راهنما را {s.brand}، مجموعه‌ی آموزشی استاد {s.teacherName}، مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴ و طراح آزمون‌های قلم‌چی و خیلی سبز، تهیه کرده است.
      </p>
      <p className="mb-10 max-w-3xl leading-9 text-white/75">
        اگر دانش‌آموز دهم یا یازدهم هستید، با همین صفحه می‌توانید درس مدرسه را از حالا با نگاه کنکوری بخوانید. اگر دوازدهمی یا فارغ‌التحصیل هستید، از
        بخش‌های «کدام فصل‌ها محاسباتی‌اند» و «نقشه‌ی راه مطالعه» شروع کنید تا وقتتان را روی نقطه‌های ضعف بگذارید. هر جا صفحه‌ی کامل یک فصل یا آزمون
        آنلاین آن آماده باشد، پیوندش کنار همان فصل آمده است.
      </p>

      <section className="mb-12" aria-labelledby="ketab-ha">
        <h2 id="ketab-ha" className="mb-5 text-2xl font-black">شیمی کنکور از کدام کتاب‌هاست؟</h2>
        <p className="mb-4 max-w-3xl leading-9 text-white/75">
          شیمی در کنکور سراسری جزو درس‌های اختصاصی هر دو گروه آزمایشی علوم تجربی و علوم ریاضی و فنی است و منبع آن سه کتاب درسی شیمی دوره‌ی دوم متوسطه
          است: شیمی (۱) پایه‌ی دهم، شیمی (۲) پایه‌ی یازدهم و شیمی (۳) پایه‌ی دوازدهم. این کتاب‌ها برای دانش‌آموزان تجربی و ریاضی یکسان‌اند، پس محتوای
          شیمی دو گروه هم یکی است. تعداد سؤال، زمان پاسخ‌گویی و ضریب درس در هر گروه را سازمان سنجش آموزش کشور هر سال در دفترچه‌ی راهنمای ثبت‌نام اعلام می‌کند.
        </p>
        <p className="mb-5 max-w-3xl leading-9 text-white/75">
          ملاک نهایی منابع همان دفترچه است: چاپ کتاب‌هایی که مبنای سؤال‌اند و هر بخشی که از منابع کنار گذاشته شود، فقط در اطلاعیه‌ی رسمی معتبر است.
          کتاب‌ها را از نسخه‌ی رسمی دفتر تألیف کتاب‌های درسی بخوانید، نه فقط از خلاصه‌ها و جزوه‌ها؛ بسیاری از سؤال‌های شیمی به جمله‌ها، جدول‌ها و شکل‌های خود کتاب برمی‌گردند.
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {GRADE_LIST.filter((g) => g.book).map((g) => (
            <li key={g.key} className="card flex items-start gap-3 p-4 text-sm leading-7">
              <BookOpen aria-hidden className="mt-1 size-4 shrink-0 text-cyan" />
              <a href={g.book!.url} target="_blank" rel="noopener" className="font-bold text-white/85 hover:text-cyan">
                {g.book!.name} <ExternalLink aria-hidden className="inline size-3.5" />
                <span className="block text-xs font-normal text-white/50">PDF رسمی، {g.book!.edition}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12" aria-labelledby="naghshe">
        <h2 id="naghshe" className="mb-3 text-2xl font-black">نقشه‌ی ده فصل شیمی کنکور</h2>
        <p className="mb-5 max-w-3xl leading-9 text-white/75">
          سه کتاب روی هم ده فصل دارند: سه فصل در دهم، سه فصل در یازدهم و چهار فصل در دوازدهم. برای هر فصل، نوع غالب آن و مهم‌ترین مهارتی که برای تست
          می‌خواهد آمده است.
        </p>
        <div className="grid gap-6">
          {GRADE_LIST.map((g) => (
            <div key={g.key} className="card p-5 sm:p-6">
              <h3 className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xl font-black">
                <span>شیمی {g.name}</span>
                <RouteLink path={g.path} className="inline-flex items-center gap-1 text-xs font-bold text-cyan hover:underline" fallback={null}>
                  آموزش شیمی {g.name} فصل‌به‌فصل <ChevronLeft aria-hidden className="size-3" />
                </RouteLink>
              </h3>
              <ol className="grid gap-4 md:grid-cols-2">
                {g.chapters.map((c, i) => {
                  const n = i + 1;
                  const meta = CHAPTER_NOTES[g.key][i];
                  const hasLinks = isLive(chapterPath(g.key, n)) || isLive(quizPath(g.key, n));
                  return (
                    <li key={c.slug} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="mb-2 flex flex-wrap items-center gap-2 font-black">
                        <span>
                          فصل {faslWord(n)}: {c.title}
                        </span>
                        {meta && <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", KIND[meta.kind].cls)}>{KIND[meta.kind].label}</span>}
                      </p>
                      {meta && (
                        <p className="text-sm leading-7 text-white/70">
                          <ChemText text={meta.note} />
                        </p>
                      )}
                      {hasLinks && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <RouteLink path={chapterPath(g.key, n)} fallback={null} className="btn-ghost btn-sm">
                            <BookOpen aria-hidden className="size-4" /> {chapterLabel(g.key, n)}
                          </RouteLink>
                          <RouteLink path={quizPath(g.key, n)} fallback={null} className="btn-ghost btn-sm">
                            {quizLabel(g.key, n)}
                          </RouteLink>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12" aria-labelledby="mohasebati">
        <h2 id="mohasebati" className="mb-3 text-2xl font-black">کدام فصل‌ها محاسباتی‌اند و کدام مفهومی؟</h2>
        <p className="mb-5 max-w-3xl leading-9 text-white/75">
          سؤال‌های شیمی کنکور سه جنس دارند: مسئله‌ی محاسباتی، سؤال مفهومی که استدلال می‌خواهد، و سؤال حفظی که مستقیم به متن، جدول یا شکل کتاب برمی‌گردد.
          فصل‌ها از این نظر یکسان نیستند و دانستن جنس هر فصل کمک می‌کند روش مطالعه‌ی درستی برایش انتخاب کنید.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {STUDY_TYPES.map((x) => (
            <div key={x.kind} className="card p-5">
              <x.icon aria-hidden className="mb-3 size-7 text-cyan" strokeWidth={1.6} />
              <h3 className="mb-2 font-black">{KIND[x.kind].label}</h3>
              <p className="text-sm leading-7 text-white/70">
                <ChemText text={x.text} />
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">
          این دسته‌بندی کیفی و برای برنامه‌ریزی مطالعه است، نه پیش‌بینی تعداد سؤال هر فصل. سهم واقعی فصل‌ها در کنکورهای گذشته را فقط با شمارش دفترچه‌های رسمی سؤال می‌شود به دست آورد.
        </p>
      </section>

      <section className="mb-12" aria-labelledby="masir">
        <h2 id="masir" className="mb-5 text-2xl font-black">نقشه‌ی راه مطالعه‌ی شیمی کنکور در چهار مرحله</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((x, i) => (
            <li key={x.t} className="card p-5">
              <x.icon aria-hidden className="mb-3 size-8 text-cyan" strokeWidth={1.6} />
              <h3 className="mb-1 font-black">
                {faNum(i + 1)}. {x.t}
              </h3>
              <p className="text-sm leading-7 text-white/65">{x.d}</p>
            </li>
          ))}
        </ol>
        {(method || fromZero) && (
          <p className="mt-5 max-w-3xl leading-8 text-white/70">
            {method && (
              <>
                شرح کامل هر مرحله در مقاله‌ی{" "}
                <Link href={`/articles/${method.slug}`} className="font-bold text-cyan hover:underline">{method.title}</Link> آمده است.{" "}
              </>
            )}
            {fromZero && (
              <>
                اگر از صفر شروع می‌کنید، مقاله‌ی{" "}
                <Link href={`/articles/${fromZero.slug}`} className="font-bold text-cyan hover:underline">{fromZero.title}</Link> را بخوانید.
              </>
            )}
          </p>
        )}
      </section>

      <section className="mb-12" aria-labelledby="eshtebah">
        <h2 id="eshtebah" className="mb-5 text-2xl font-black">اشتباه‌های رایج در شیمی کنکور</h2>
        <ul className="card grid gap-4 p-6">
          {MISTAKES.map((m) => (
            <li key={m.t} className="flex items-start gap-3">
              <AlertTriangle aria-hidden className="mt-1.5 size-4 shrink-0 text-amber" />
              <p className="leading-8 text-white/75">
                <b className="text-white/90"><ChemText text={m.t} /></b>: <ChemText text={m.d} />
              </p>
            </li>
          ))}
        </ul>
      </section>

      <RelatedLinks
        title="ابزارها، برگه‌ی فرمول و آزمون آنلاین"
        links={[
          { path: TOOL_PATHS.formulas, desc: "رابطه‌های مهم سه کتاب در یک برگه‌ی قابل چاپ" },
          { path: QUIZ_HUB, desc: "آزمون رایگان فصل‌به‌فصل با پاسخ تشریحی" },
          { path: TOOL_PATHS.molarMass, desc: "جرم مولی ترکیب‌ها با جزئیات محاسبه" },
          { path: TOOL_PATHS.balance, desc: "موازنه‌ی آنلاین معادله‌ی واکنش" },
          { path: TOOL_PATHS.ph, desc: "محاسبه‌ی pH اسیدها و بازها" },
          { path: TOOL_PATHS.periodic, desc: "نام فارسی و ویژگی‌های عنصرها" },
        ]}
      />

      <section className="mb-12" aria-labelledby="nahayi">
        <h2 id="nahayi" className="mb-5 text-2xl font-black">امتحان نهایی و کنکور</h2>
        <p className="mb-4 max-w-3xl leading-9 text-white/75">
          در سال‌های اخیر نمره‌ی امتحان‌های نهایی، با عنوان «سوابق تحصیلی»، سهم بزرگی در نتیجه‌ی کنکور پیدا کرده است و شیمی هم جزو درس‌هایی است که امتحان
          نهایی دارد. پایه‌های مشمول، وزن سوابق تحصیلی و شیوه‌ی محاسبه‌ی نمره را مصوبه‌های شورای عالی انقلاب فرهنگی و اطلاعیه‌های سازمان سنجش آموزش کشور و
          وزارت آموزش و پرورش تعیین می‌کنند و این قواعد در چند سال گذشته چند بار تغییر کرده است. پس به عددهای دست‌به‌دست‌شده تکیه نکنید و آخرین اطلاعیه را از{" "}
          <a href="https://www.sanjesh.org" target="_blank" rel="noopener" className="font-bold text-cyan hover:underline">سایت رسمی سازمان سنجش</a> بخوانید.
        </p>
        <p className="max-w-3xl leading-9 text-white/75">
          از نظر مطالعه، این دو آزمون رقیب هم نیستند: امتحان نهایی نوشتن دقیق تعریف‌ها و مرحله‌های حل مسئله را می‌خواهد و کنکور سرعت و تشخیص گزینه‌ی درست را.
          اگر هر فصل را مفهومی بخوانید و مسئله‌ها را با راه‌حل کامل تمرین کنید، برای هر دو آماده شده‌اید؛ تست زمان‌دار را هم به آن اضافه کنید.
        </p>
      </section>

      <aside className="card glow-border mb-12 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="flex items-center gap-2 text-lg font-black">
            <FlaskConical aria-hidden className="size-5 text-cyan" /> کلاس و همایش شیمی کنکور با استاد {s.teacherName}
          </p>
          <p className="mt-1 text-sm leading-7 text-white/65">
            کلاس خصوصی و گروهی شیمی کنکور و همایش‌های جمع‌بندی در {city} برگزار می‌شود. زمان همایش‌ها در اپلیکیشن {s.brand} و با پیامک اعلام می‌شود.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/tadris-shimi" className="btn-primary">
            کلاس شیمی کنکور در {city} <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <Link href="/gallery" className="btn-ghost">گالری همایش‌ها</Link>
          {s.phone && (
            <a href={`tel:${s.phone}`} className="btn-ghost">
              <Phone aria-hidden className="size-4" /> <bdi dir="ltr">{faNum(s.phone)}</bdi>
            </a>
          )}
        </div>
      </aside>

      <section className="mb-12" aria-labelledby="porsesh-ha">
        <h2 id="porsesh-ha" className="mb-5 text-2xl font-black">پرسش‌های متداول شیمی کنکور</h2>
        <div className="grid gap-3">
          {FAQS.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-bold">
                {f.q}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-white/40 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 leading-8 text-white/70">
                <ChemText text={f.a} />
              </p>
            </details>
          ))}
        </div>
      </section>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <p className="font-bold">آموزش شیمی دهم، یازدهم و دوازدهم با ویدیوهای استاد {s.teacherName}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/javad-partovi" className="btn-ghost btn-sm">معرفی استاد {s.teacherName}</Link>
          <Link href="/courses" className="btn-primary btn-sm">ویدیوهای آموزش شیمی</Link>
        </div>
      </div>
    </main>
  );
}
