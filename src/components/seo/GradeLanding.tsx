import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarRange, ChevronDown, ChevronLeft, ExternalLink, Lightbulb, Mountain, PlayCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { canonicalUrl, eduGraph, itemListLd, pageMeta } from "@/lib/page-meta";
import { ldRef } from "@/lib/seo";
import { GRADE_LIST, GRADE_PAGES, type GradeKey } from "@/lib/syllabus";
import { TOOL_PATHS, chapterLabel, chapterPath, crumbsFor, faslWord, isLive, quizLabel, quizPath, type ToolKey } from "@/lib/site-routes";
import { GRADE_CONTENT } from "@/content/chapters/grades";
import { ChemText } from "@/components/seo/Chem";
import { Breadcrumbs, Byline, RelatedLinks, RouteLink, SoftCta } from "@/components/seo/EduChrome";
import { JsonLd } from "@/components/JsonLd";
import { faNum } from "@/lib/utils";

/**
 * صفحه‌ی هر پایه (/shimi-dahom، /shimi-yazdahom، /shimi-davazdahom): معرفی، کارت فصل‌ها با پیوند به صفحه‌ی فصل
 * و آزمون آن (فقط وقتی live باشند)، پیش‌نیازها، برنامه‌ی سال، بخش‌های چالشی، ابزارها، ویدیوها و پرسش‌های متداول.
 * متن هر پایه در src/content/chapters/grades.ts است.
 */

/** توضیح کوتاه ابزارها برای این صفحه */
const TOOL_DESC: Record<ToolKey, string> = {
  periodic: "نام فارسی و ویژگی‌های عنصرها",
  molarMass: "جرم مولی ترکیب‌ها با جزئیات محاسبه",
  balance: "موازنه‌ی آنلاین معادله‌ی واکنش",
  ph: "محاسبه‌ی pH اسیدها و بازها",
  formulas: "همه‌ی رابطه‌های مهم در یک برگه",
};

const description = (g: GradeKey, teacher: string) => `${GRADE_CONTENT[g].description} با استاد ${teacher}.`;

export async function gradeMetadata(g: GradeKey): Promise<Metadata> {
  const s = await getSetting("site");
  return pageMeta({ title: GRADE_CONTENT[g].title, description: description(g, s.teacherName), path: GRADE_PAGES[g].path });
}

export async function GradeLanding({ g }: { g: GradeKey }) {
  const info = GRADE_PAGES[g];
  const gc = GRADE_CONTENT[g];
  const [s, topics] = await Promise.all([
    getSetting("site"),
    db.topic
      .findMany({ where: { published: true, grade: g }, orderBy: { order: "asc" }, select: { id: true, title: true, _count: { select: { videos: { where: { published: true } } } } } })
      .catch(() => []),
  ]);
  const crumbs = crumbsFor(info.path);
  const gradeTitle = `شیمی ${info.name}`;
  const liveChapters = info.chapters.map((_, i) => ({ name: chapterLabel(g, i + 1), path: chapterPath(g, i + 1) })).filter((c) => isLive(c.path));
  const listId = `${canonicalUrl(info.path)}#chapters`;
  const ld = eduGraph(s, {
    path: info.path,
    title: `آموزش ${gradeTitle} فصل‌به‌فصل`,
    description: description(g, s.teacherName),
    type: "CollectionPage",
    breadcrumb: crumbs,
    educationalLevel: `پایه‌ی ${info.name}`,
    about: gradeTitle,
    teaches: info.chapters.map((c) => c.title),
    extra: liveChapters.length ? { mainEntity: ldRef(listId) } : undefined,
    nodes: liveChapters.length ? [itemListLd(`فصل‌های ${gradeTitle}`, liveChapters, listId)] : [],
  });
  const firstVideo = topics.find((t) => t._count.videos > 0);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <h1 className="section-title mb-4">
        آموزش <span className="text-gradient">{gradeTitle}</span> فصل‌به‌فصل
      </h1>
      <Byline s={s} path={info.path} />
      {gc.intro.map((p, i) => (
        <p key={i} className="mb-4 max-w-3xl leading-9 text-white/75">
          <ChemText text={p} />
        </p>
      ))}
      <div className="mb-12 mt-6 flex flex-wrap gap-3">
        <Link href={firstVideo ? `/courses/${firstVideo.id}` : "/courses"} className="btn-primary">
          <PlayCircle aria-hidden className="size-4" /> ویدیوهای آموزش {gradeTitle}
        </Link>
        <a href="#barname" className="btn-ghost">
          <CalendarRange aria-hidden className="size-4" /> برنامه‌ی مطالعه‌ی سال
        </a>
      </div>

      <section className="mb-12" aria-labelledby="fasl-ha">
        <h2 id="fasl-ha" className="mb-5 text-2xl font-black">فصل‌های {gradeTitle}</h2>
        <div className="grid gap-4">
          {info.chapters.map((c, i) => {
            const n = i + 1;
            return (
              <article key={c.slug} className="card p-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-black">
                  <BookOpen aria-hidden className="size-5 shrink-0 text-cyan" /> فصل {faslWord(n)}: {c.title}
                </h3>
                <p className="mb-4 leading-8 text-white/75">
                  <ChemText text={c.summary} />
                </p>
                <ul className="mb-4 flex flex-wrap gap-2" aria-label={`زیرفصل‌های فصل ${faslWord(n)}`}>
                  {c.topics.map((t) => (
                    <li key={t} className="chip">{t}</li>
                  ))}
                </ul>
                <p className="flex items-start gap-2 rounded-2xl bg-amber/10 px-4 py-3 text-sm leading-7 text-white/80">
                  <Lightbulb aria-hidden className="mt-1 size-4 shrink-0 text-amber" /> {c.tip}
                </p>
                {(isLive(chapterPath(g, n)) || isLive(quizPath(g, n))) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <RouteLink path={chapterPath(g, n)} fallback={null} className="btn-primary btn-sm">
                      خلاصه و نمونه سوال {chapterLabel(g, n)}
                    </RouteLink>
                    <RouteLink path={quizPath(g, n)} fallback={null} className="btn-ghost btn-sm">
                      {quizLabel(g, n)}
                    </RouteLink>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mb-12" aria-labelledby="pishniaz">
        <h2 id="pishniaz" className="mb-5 text-2xl font-black">پیش‌نیاز و ارتباط با پایه‌های دیگر</h2>
        {gc.prereq.map((p, i) => (
          <p key={i} className="mb-4 max-w-3xl leading-9 text-white/75">
            <ChemText text={p} />
          </p>
        ))}
      </section>

      <section id="barname" className="mb-12 scroll-mt-28" aria-labelledby="barname-title">
        <h2 id="barname-title" className="mb-5 text-2xl font-black">برنامه‌ی پیشنهادی مطالعه‌ی {gradeTitle}، مهر تا خرداد</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {gc.plan.map((p) => (
            <li key={p.months} className={p.exam ? "card border-cyan/30 p-4" : "card p-4"}>
              <p className="mb-1 font-black text-cyan">{p.months}</p>
              <p className="text-sm leading-7 text-white/75">
                <ChemText text={p.text} />
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">
          <ChemText text={gc.planNote} />
        </p>
      </section>

      <section className="mb-12" aria-labelledby="chaleshi">
        <h2 id="chaleshi" className="mb-5 text-2xl font-black">بخش‌های چالشی {gradeTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {gc.challenges.map((c) => (
            <div key={c.title} className="card p-5">
              <h3 className="mb-2 flex items-center gap-2 font-black">
                <Mountain aria-hidden className="size-4 shrink-0 text-rose" /> {c.title}
              </h3>
              <p className="text-sm leading-7 text-white/75">
                <ChemText text={c.text} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <RelatedLinks title={`ابزارهای کمکی ${gradeTitle}`} links={gc.tools.map((k) => ({ path: TOOL_PATHS[k], desc: TOOL_DESC[k] }))} />

      {topics.length > 0 && (
        <section className="mb-12" aria-labelledby="video-ha">
          <h2 id="video-ha" className="mb-5 text-2xl font-black">ویدیوهای آموزش {gradeTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {topics.map((t) => (
              <Link key={t.id} href={`/courses/${t.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-cyan/30">
                <span className="font-bold">{t.title}</span>
                <span className="shrink-0 text-xs text-white/50">{faNum(t._count.videos)} ویدیو</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {info.book && (
        <p className="mb-12 flex flex-wrap items-center gap-2 text-sm leading-7 text-white/65">
          <BookOpen aria-hidden className="size-4 shrink-0 text-cyan" />
          کتاب درسی رسمی:
          <a href={info.book.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-bold text-white/85 underline decoration-white/20 underline-offset-4 hover:text-cyan">
            {info.book.name}، {info.book.edition} <ExternalLink aria-hidden className="size-3.5" />
          </a>
          <span>(سایت دفتر تألیف کتاب‌های درسی)</span>
        </p>
      )}

      <section className="mb-12" aria-labelledby="porsesh-ha">
        <h2 id="porsesh-ha" className="mb-5 text-2xl font-black">پرسش‌های متداول {gradeTitle}</h2>
        <div className="grid gap-3">
          {gc.faqs.map((f) => (
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

      <nav aria-label="پایه‌های دیگر" className="mb-4 grid gap-3 sm:grid-cols-3">
        {[...GRADE_LIST.filter((x) => x.key !== g).map((x) => ({ href: x.path, t: `شیمی ${x.name}` })), { href: "/shimi-konkur", t: "شیمی کنکور" }].map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-center justify-between p-4 font-bold hover:border-cyan/30">
            {l.t}
            <ChevronLeft aria-hidden className="size-4 text-white/40" />
          </Link>
        ))}
      </nav>

      <SoftCta s={s} />
    </main>
  );
}
