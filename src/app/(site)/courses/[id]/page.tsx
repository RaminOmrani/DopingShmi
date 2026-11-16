import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Lightbulb, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { gradeLabel } from "@/lib/constants";
import { faNum, fmtToman } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { LD_ID, ldRef, THIN_TOPIC_DESC } from "@/lib/seo";
import { pageMeta, eduGraph } from "@/lib/page-meta";
import { GRADE_PAGES, type GradeKey } from "@/lib/syllabus";
import { BRAND, chapterCount, chapterLabel, chapterPath, chapterTitle, crumbsFor, faslWord, type Crumb } from "@/lib/site-routes";
import { JsonLd } from "@/components/JsonLd";
import { ChemText, chemTextPlain } from "@/components/seo/Chem";
import { Breadcrumbs, RouteLink } from "@/components/seo/EduChrome";
import { TopicAccess, BundleAccess } from "./CourseAccess";

/**
 * صفحه‌ی مبحث یا بسته‌ی ویدیویی. خود صفحه ISR است (کوکی نمی‌خواند) و برای همه نسخه‌ی «مهمان» را می‌سازد؛
 * دسترسی و پیشرفت کاربر واردشده را جزیره‌ی کلاینت CourseAccess از /api/me می‌گیرد.
 */
export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

const loadTopic = cache((id: string) =>
  db.topic.findUnique({ where: { id }, include: { videos: { where: { published: true }, orderBy: { order: "asc" } }, bundles: { where: { active: true } } } }),
);
const loadBundle = cache((id: string) =>
  db.bundle.findUnique({
    where: { id },
    include: { topics: { where: { published: true }, orderBy: [{ grade: "asc" }, { order: "asc" }], include: { _count: { select: { videos: { where: { published: true } } } } } } },
  }),
);

const isGrade = (g: string): g is GradeKey => g in GRADE_PAGES;
/** برای مقایسه‌ی عنوان: بدون فاصله، نیم‌فاصله و نشانه‌ها */
const norm = (t: string) => t.replace(/[\s‌،,:؛.\-–—«»()]/g, "");

/**
 * مبحث ↔ فصل کتاب درسی: «فصل اول…» در عنوان، یا عنوان (فعلی یا قدیمی) فصل در syllabus.ts؛ در غیر این صورت رتبه‌ی
 * مبحث در پایه، فقط وقتی تعداد مباحث منتشرشده‌ی آن پایه دقیقاً برابر تعداد فصل‌هاست (تا برچسب اشتباه نخورد).
 */
const chapterOf = cache(async (id: string, title: string, grade: string): Promise<number | null> => {
  if (!isGrade(grade)) return null;
  const count = chapterCount(grade);
  const word = /فصل\s*(اول|دوم|سوم|چهارم)/.exec(title);
  if (word) {
    const n = ["اول", "دوم", "سوم", "چهارم"].indexOf(word[1]) + 1;
    if (n <= count) return n;
  }
  const t = norm(title);
  const byTitle = GRADE_PAGES[grade].chapters.findIndex((c) => [c.title, ...(c.oldTitles ?? [])].some((x) => t.includes(norm(x))));
  if (byTitle >= 0) return byTitle + 1;
  const siblings = await db.topic.findMany({ where: { grade, published: true }, orderBy: { order: "asc" }, select: { id: true } });
  if (siblings.length !== count) return null;
  const i = siblings.findIndex((s) => s.id === id);
  return i >= 0 ? i + 1 : null;
});

/** متن تا max نویسه، بریده‌شده سر یک کلمه */
const clip = (t: string, max: number) => {
  const chars = [...t.replace(/\s+/g, " ").trim()];
  if (chars.length <= max) return chars.join("");
  const cut = chars.slice(0, max - 1).join("");
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trim()}…`;
};
/** اولین عنوانی که در ۶۰ نویسه جا شود */
const fit = (...titles: string[]) => titles.find((t) => [...t].length <= 60) ?? clip(titles[titles.length - 1], 60);

interface TopicSeo {
  title: string;
  description: string;
  noindex: boolean;
  n: number | null;
  grade: GradeKey | null;
}

/** عنوان، توضیح و index بودن صفحه‌ی مبحث (یک‌جا تا متادیتا و JSON-LD یکی باشند) */
async function topicSeo(topic: NonNullable<Awaited<ReturnType<typeof loadTopic>>>, teacher: string): Promise<TopicSeo> {
  const grade = isGrade(topic.grade) ? topic.grade : null;
  const n = await chapterOf(topic.id, topic.title, topic.grade);
  const hasFree = topic.videos.some((v) => v.isFree);
  const gl = gradeLabel(topic.grade);
  const title =
    grade && n
      ? fit(`ویدیوهای ${chapterLabel(grade, n)}${hasFree ? " + جلسه رایگان" : ""} | ${BRAND}`, `ویدیوهای ${chapterLabel(grade, n)}${hasFree ? " + جلسه رایگان" : ""}`, `ویدیوهای ${chapterLabel(grade, n)}`)
      : fit(`ویدیوهای ${topic.title}، شیمی ${gl} | ${BRAND}`, `ویدیوهای ${topic.title} | ${BRAND}`, topic.title);
  const own = topic.description?.trim() ?? "";
  const free = hasFree ? "جلسه‌ی اول رایگان است." : "";
  let description: string;
  if (own.length >= 100) description = clip(own, 165);
  else if (grade && n) {
    const ch = GRADE_PAGES[grade].chapters[n - 1];
    const head = own || `ویدیوهای ${chapterLabel(grade, n)} («${chapterTitle(grade, n)}») با تدریس استاد ${teacher}`;
    description = clip(`${head}: ${ch.topics.map((x) => chemTextPlain(x)).join("، ")}. ${free}`, 165);
  } else description = clip(`${own || `ویدیوهای ${topic.title}`}؛ آموزش شیمی ${gl} با تدریس استاد ${teacher} در ${BRAND}. ${free}`, 165);
  return { title, description, noindex: topic.videos.length === 0 && own.length < THIN_TOPIC_DESC, n, grade };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getSetting("site");
  if (id.startsWith("bundle-")) {
    const b = await loadBundle(id.slice(7));
    if (!b || !b.active) return {};
    const description = clip(b.description?.trim() || `${b.title}: دسترسی به ویدیوهای ${faNum(b.topics.length)} مبحث شیمی با تدریس استاد ${s.teacherName} در ${BRAND}؛ ${b.topics.map((t) => t.title).join("، ")}`, 165);
    return pageMeta({ title: fit(`${b.title} | ${BRAND}`, b.title), description, path: `/courses/${id}`, noindex: b.topics.length === 0 });
  }
  const topic = await loadTopic(id);
  if (!topic || !topic.published) return {};
  const seo = await topicSeo(topic, s.teacherName);
  return pageMeta({ title: seo.title, description: seo.description, path: `/courses/${id}`, noindex: seo.noindex });
}

/** مسیر راهنما: مبحث هر پایه زیر صفحه‌ی همان پایه؛ مبحث عمومی و بسته زیر «ویدیوهای آموزشی» */
const crumbsOf = (grade: GradeKey | null, name: string, path: string): Crumb[] => [...crumbsFor(grade ? GRADE_PAGES[grade].path : "/courses"), { name, path }];

export default async function CoursePage({ params }: Props) {
  const { id } = await params;
  const site = await getSetting("site");
  const path = `/courses/${id}`;

  if (id.startsWith("bundle-")) {
    const b = await loadBundle(id.slice(7));
    if (!b || !b.active) notFound();
    const crumbs = crumbsOf(null, b.title, path);
    return (
      <main className="mx-auto max-w-4xl px-5 pb-10 pt-32">
        <JsonLd
          data={eduGraph(site, {
            path,
            title: b.title,
            description: b.description || b.title,
            type: "Course",
            breadcrumb: crumbs,
            published: b.createdAt.toISOString(),
            updated: b.createdAt.toISOString(),
            teacherReviewed: false,
            extra: { provider: ldRef(LD_ID.org), instructor: ldRef(LD_ID.teacher), isAccessibleForFree: false },
          })}
        />
        <Breadcrumbs items={crumbs} />
        <p className="mb-2 text-sm font-bold text-cyan">بسته جامع</p>
        <h1 className="section-title mb-4">{b.title}</h1>
        {b.description && <p className="mb-6 leading-8 text-white/65">{b.description}</p>}
        <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-2xl font-black text-gradient">{fmtToman(b.price)}</p>
            <p className="text-sm text-white/55">{b.durationDays ? `دسترسی ${faNum(b.durationDays)} روزه` : "دسترسی دائمی"} · {faNum(b.topics.length)} مبحث</p>
          </div>
          <BundleAccess bundleId={b.id} />
        </div>
        <div className="grid gap-3">
          {b.topics.map((t) => (
            <Link key={t.id} href={`/courses/${t.id}`} className="card flex items-center justify-between p-4 hover:border-cyan/30">
              <span className="font-bold">{t.title} <span className="text-xs text-white/45">({gradeLabel(t.grade)})</span></span>
              <span className="text-xs text-white/50">{faNum(t._count.videos)} ویدیو</span>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  const topic = await loadTopic(id);
  if (!topic || !topic.published) notFound();
  const seo = await topicSeo(topic, site.teacherName);
  const { grade, n } = seo;
  const chapter = grade && n ? GRADE_PAGES[grade].chapters[n - 1] : null;
  const crumbs = crumbsOf(grade, topic.title, path);
  const newest = topic.videos.reduce<Date>((m, v) => (v.createdAt > m ? v.createdAt : m), topic.createdAt);
  const allFree = topic.videos.length > 0 && topic.videos.every((v) => v.isFree);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32">
      <JsonLd
        data={eduGraph(site, {
          path,
          title: `${topic.title}، شیمی ${gradeLabel(topic.grade)}`,
          description: seo.description,
          type: "Course",
          breadcrumb: crumbs,
          published: topic.createdAt.toISOString(),
          updated: newest.toISOString(),
          teacherReviewed: false,
          educationalLevel: grade ? `پایه‌ی ${GRADE_PAGES[grade].name}` : undefined,
          about: chapter ? chapter.title : undefined,
          teaches: chapter ? chapter.topics.map((x) => chemTextPlain(x)) : undefined,
          image: topic.cover || undefined,
          extra: { provider: ldRef(LD_ID.org), instructor: ldRef(LD_ID.teacher), isAccessibleForFree: allFree },
        })}
      />
      <Breadcrumbs items={crumbs} />
      {grade ? (
        <Link href={GRADE_PAGES[grade].path} className="mb-2 inline-block text-sm font-bold text-cyan hover:underline">شیمی {gradeLabel(topic.grade)}</Link>
      ) : (
        <p className="mb-2 text-sm font-bold text-cyan">شیمی {gradeLabel(topic.grade)}</p>
      )}
      <h1 className="section-title mb-4">{topic.title}</h1>
      {topic.description && <p className="mb-6 max-w-3xl leading-8 text-white/65">{topic.description}</p>}

      <TopicAccess
        topicId={topic.id}
        price={topic.price}
        videos={topic.videos.map((v) => ({ id: v.id, title: v.title, durationSec: v.durationSec, isFree: v.isFree }))}
        bundles={topic.bundles.map((b) => ({ id: b.id, title: b.title }))}
      />

      {grade && n && chapter && (
        <section className="mt-12">
          <h2 className="mb-2 text-2xl font-black">سرفصل‌های {chapterLabel(grade, n)} در کتاب درسی</h2>
          <p className="mb-5 text-sm text-white/55">«{chapter.title}»؛ زیرفصل‌های اصلی به ترتیب کتاب:</p>
          <ol className="mb-5 grid gap-2 sm:grid-cols-2">
            {chapter.topics.map((t, i) => (
              <li key={t} className="card flex items-baseline gap-3 px-4 py-3 text-sm">
                <span className="text-xs font-bold text-cyan">{faNum(i + 1)}</span>
                <span><ChemText text={t} /></span>
              </li>
            ))}
          </ol>
          <p className="mb-6 flex items-start gap-2 text-sm leading-7 text-white/70">
            <Lightbulb aria-hidden className="mt-1 size-4 shrink-0 text-amber" /> <ChemText text={chapter.tip} />
          </p>
          <div className="flex flex-wrap gap-3">
            <RouteLink path={chapterPath(grade, n)} fallback={null} className="btn-primary">
              خلاصه و نکات فصل {faslWord(n)} شیمی {GRADE_PAGES[grade].name} <ChevronLeft className="size-4" />
            </RouteLink>
            <Link href={GRADE_PAGES[grade].path} className="btn-ghost">همه‌ی فصل‌های شیمی {GRADE_PAGES[grade].name}</Link>
          </div>
        </section>
      )}
    </main>
  );
}
