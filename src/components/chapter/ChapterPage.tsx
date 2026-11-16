import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid, PlayCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { LD_ID, ldRef } from "@/lib/seo";
import { eduGraph, pageMeta, pageRef } from "@/lib/page-meta";
import { GRADE_PAGES, type GradeKey } from "@/lib/syllabus";
import {
  TOOL_PATHS,
  chapterCount,
  chapterLabel,
  chapterPath,
  crumbsFor,
  gradeName,
  isLive,
  parseFasl,
  quizLabel,
  quizPath,
  type ToolKey,
} from "@/lib/site-routes";
import { getChapter, type ChapterContent } from "@/content/chapters";
import { chemTextPlain } from "@/components/seo/Chem";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Byline, RelatedLinks, RouteLink, SoftCta } from "@/components/seo/EduChrome";
import { faNum } from "@/lib/utils";
import { ChapterBody } from "./ChapterBody";

/**
 * صفحه‌ی فصل (/shimi-dahom/fasl-1 و …): پوسته‌ی سروری دور ChapterBody — مسیر راهنما، امضا، JSON-LD،
 * لینک آزمون فصل، ویدیوی رایگان، ابزارهای مرتبط، فصل قبل و بعد و یک دعوت ملایم به کلاس.
 * فصلی که محتوایش هنوز جای خالی است ۴۰۴ می‌دهد.
 */

/** توضیح کوتاه ابزارها در «ابزارهای مرتبط» */
const TOOL_DESC: Record<ToolKey, string> = {
  periodic: "نام فارسی عنصرها، عدد اتمی و جرم اتمی",
  molarMass: "محاسبه‌ی جرم مولی هر ترکیب با جزئیات",
  balance: "موازنه‌ی معادله و تمرین روش وارسی",
  ph: "محاسبه‌ی pH محلول اسیدها و بازها",
  formulas: "رابطه‌های مهم هر فصل در یک برگه",
};

function resolve(g: GradeKey, fasl: string): { n: number; c: ChapterContent } {
  const n = parseFasl(fasl, g);
  const c = n ? getChapter(g, n) : null;
  if (!n || !c) notFound();
  return { n, c };
}

/** متادیتای صفحه‌ی فصل (generateMetadata) */
export async function chapterMetadata(g: GradeKey, fasl: string): Promise<Metadata> {
  const { n, c } = resolve(g, fasl);
  return pageMeta({ title: chemTextPlain(c.metaTitle), description: chemTextPlain(c.metaDescription), path: chapterPath(g, n), type: "article" });
}

/** یکسان‌سازی عنوان برای تطبیق مبحث (بدون فاصله، نیم‌فاصله و نشانه‌ها؛ ی و ک عربی به فارسی) */
const norm = (s: string) => s.replace(/[\s‌،,:\-ـ]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");

/** مبحث منتشرشده‌ی متناظر فصل در /courses (تطبیق با عنوان، وگرنه ترتیب)؛ فقط اگر ویدیوی منتشرشده داشته باشد */
async function chapterTopic(g: GradeKey, n: number) {
  try {
    const topics = await db.topic.findMany({
      where: { published: true, grade: g },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        _count: { select: { videos: { where: { published: true } } } },
        videos: { where: { published: true, isFree: true }, select: { id: true }, take: 1 },
      },
    });
    const info = GRADE_PAGES[g].chapters[n - 1];
    const names = [info.title, ...(info.oldTitles ?? [])].map(norm);
    const t = topics.find((x) => names.some((name) => norm(x.title).includes(name))) ?? topics[n - 1];
    return t && t._count.videos > 0 ? { id: t.id, count: t._count.videos, hasFree: t.videos.length > 0 } : null;
  } catch {
    return null;
  }
}

/** ISO 8601 برای مدت ویدیو */
const isoDuration = (sec: number) => `PT${Math.floor(sec / 60)}M${Math.round(sec % 60)}S`;

export async function ChapterPage({ g, fasl }: { g: GradeKey; fasl: string }) {
  const { n, c } = resolve(g, fasl);
  const [s, topic] = await Promise.all([getSetting("site"), chapterTopic(g, n)]);
  const path = chapterPath(g, n);
  const crumbs = crumbsFor(path);
  const label = chapterLabel(g, n);
  const grade = GRADE_PAGES[g];
  const qPath = quizPath(g, n);
  const prev = n > 1 ? n - 1 : null;
  const next = n < chapterCount(g) ? n + 1 : null;
  const video = c.aparat
    ? {
        "@type": "VideoObject",
        name: c.aparat.title,
        description: c.aparat.description,
        uploadDate: c.aparat.uploadDate,
        duration: isoDuration(c.aparat.durationSec),
        thumbnailUrl: c.aparat.thumbnailUrl,
        embedUrl: `https://www.aparat.com/video/video/embed/videohash/${c.aparat.id}/vt/frame`,
        url: `https://www.aparat.com/v/${c.aparat.id}`,
        inLanguage: "fa-IR",
      }
    : null;

  const ld = eduGraph(s, {
    path,
    title: chemTextPlain(c.h1),
    description: chemTextPlain(c.metaDescription),
    type: ["Article", "LearningResource"],
    breadcrumb: crumbs,
    educationalLevel: `پایه‌ی ${gradeName(g)}`,
    about: c.title,
    teaches: c.sections.map((x) => chemTextPlain(x.heading)),
    extra: {
      isPartOf: [ldRef(LD_ID.website), pageRef(grade.path, `شیمی ${grade.name}`, "CollectionPage")],
      learningResourceType: "خلاصه‌ی درس، مثال حل‌شده و نمونه سؤال",
    },
    nodes: video ? [video] : [],
  });

  return (
    <main className="mx-auto max-w-4xl px-5 pb-10 pt-32 print:max-w-none print:px-0 print:pt-0">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <h1 className="section-title mb-4 leading-tight">{c.h1}</h1>
      <Byline s={s} path={path} />

      <ChapterBody c={c} label={label} />

      {isLive(qPath) && (
        <aside className="card mb-12 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <p className="text-lg font-black">خودتان را بسنجید</p>
            <p className="mt-1 text-sm leading-7 text-white/65">آزمون آنلاین و رایگان این فصل را بدون ثبت‌نام بزنید و نتیجه را همان لحظه ببینید.</p>
          </div>
          <RouteLink path={qPath} className="btn-primary shrink-0">{quizLabel(g, n)}</RouteLink>
        </aside>
      )}

      {c.aparat && (
        <section className="mb-12 print:hidden">
          <h2 className="mb-4 text-2xl font-black">ویدیوی آموزشی {label}</h2>
          <iframe
            src={video!.embedUrl}
            title={c.aparat.title}
            loading="lazy"
            allowFullScreen
            className="aspect-video w-full rounded-2xl border border-white/10"
          />
        </section>
      )}

      {topic && (
        <section className="card mb-12 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <h2 className="text-lg font-black">ویدیوهای تدریس {label}</h2>
            <p className="mt-1 text-sm leading-7 text-white/65">
              {faNum(topic.count)} ویدیوی آموزشی با تدریس استاد {s.teacherName}
              {topic.hasFree ? "؛ جلسه‌ی رایگان هم دارد." : "."}
            </p>
          </div>
          <Link href={`/courses/${topic.id}`} className="btn-primary shrink-0">
            <PlayCircle aria-hidden className="size-4" /> ویدیوهای {label}
          </Link>
        </section>
      )}

      <RelatedLinks
        title="ابزارهای مرتبط"
        links={[...c.relatedTools.map((k) => ({ path: TOOL_PATHS[k], desc: TOOL_DESC[k] })), ...(c.related ?? [])]}
      />

      <nav aria-label="فصل‌های دیگر" className="mb-12 grid gap-3 sm:grid-cols-3 print:hidden">
        {prev ? (
          <RouteLink path={chapterPath(g, prev)} fallback={<span className="hidden sm:block" />} className="card flex items-center gap-2 p-4 font-bold hover:border-cyan/30">
            <ChevronRight aria-hidden className="size-4 shrink-0 text-white/40" /> {chapterLabel(g, prev)}
          </RouteLink>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Link href={grade.path} className="card flex items-center justify-center gap-2 p-4 font-bold hover:border-cyan/30">
          <LayoutGrid aria-hidden className="size-4 shrink-0 text-cyan" /> همه‌ی فصل‌های شیمی {grade.name}
        </Link>
        {next && (
          <RouteLink path={chapterPath(g, next)} fallback={null} className="card flex items-center justify-end gap-2 p-4 font-bold hover:border-cyan/30">
            {chapterLabel(g, next)} <ChevronLeft aria-hidden className="size-4 shrink-0 text-white/40" />
          </RouteLink>
        )}
      </nav>

      <SoftCta s={s} />
    </main>
  );
}
