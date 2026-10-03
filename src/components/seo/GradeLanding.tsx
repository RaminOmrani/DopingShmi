import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronLeft, Lightbulb, Phone, PlayCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SITE_URL, breadcrumbLd, faqLd, ldGraph } from "@/lib/seo";
import { GRADE_LIST, GRADE_PAGES, type GradeKey } from "@/lib/syllabus";
import { JsonLd } from "@/components/JsonLd";
import { faNum } from "@/lib/utils";

export async function gradeMetadata(g: GradeKey): Promise<Metadata> {
  const s = await getSetting("site");
  const info = GRADE_PAGES[g];
  const title = `آموزش شیمی ${info.name} | تدریس فصل‌به‌فصل با استاد ${s.teacherName}`;
  const description = `آموزش کامل شیمی ${info.name}: سرفصل‌ها، نکات مهم هر فصل، روش مطالعه و ویدیوهای آموزشی با استاد ${s.teacherName} — ${s.brand}.`;
  return { title: { absolute: title }, description, alternates: { canonical: info.path }, openGraph: { title, description, url: `${SITE_URL}${info.path}` } };
}

export async function GradeLanding({ g }: { g: GradeKey }) {
  const info = GRADE_PAGES[g];
  const [s, topics] = await Promise.all([
    getSetting("site"),
    db.topic.findMany({ where: { published: true, grade: g }, orderBy: { order: "asc" }, select: { id: true, title: true, _count: { select: { videos: { where: { published: true } } } } } }),
  ]);
  const faqs = [
    { q: `شیمی ${info.name} چند فصل دارد؟`, a: `کتاب شیمی ${info.name} ${faNum(info.chapters.length)} فصل دارد: ${info.chapters.map((c) => c.title).join("، ")}.` },
    { q: `بهترین روش مطالعه‌ی شیمی ${info.name} چیست؟`, a: "اول درسنامه و متن کتاب درسی را با فهم مفهوم بخوانید، بعد تمرین‌ها و مسئله‌های کتاب را حل کنید و در پایان هر فصل تست مبحثی زمان‌دار بزنید. مسئله‌ها را روزانه تمرین کنید و اشتباه‌های آزمون‌ها را تحلیل کنید." },
    { q: `کلاس یا ویدیوی آموزش شیمی ${info.name} دارید؟`, a: `بله. استاد ${s.teacherName} کلاس خصوصی و گروهی شیمی ${info.name} برگزار می‌کنند و ویدیوهای تدریس مبحث‌به‌مبحث در اپلیکیشن ${s.brand} قرار دارد؛ جلسه‌ی اول هر مبحث رایگان است.` },
  ];
  const ld = ldGraph(
    {
      "@type": "Course",
      name: `آموزش شیمی ${info.name}`,
      description: info.intro,
      url: `${SITE_URL}${info.path}`,
      inLanguage: "fa-IR",
      educationalLevel: `پایه‌ی ${info.name}`,
      provider: { "@id": `${SITE_URL}/#org` },
      instructor: { "@id": `${SITE_URL}/#teacher` },
      syllabusSections: info.chapters.map((c) => ({ "@type": "Syllabus", name: c.title, description: c.topics.join("، ") })),
    },
    faqLd(faqs),
    breadcrumbLd([{ name: s.brand, path: "/" }, { name: "شیمی کنکور", path: "/shimi-konkur" }, { name: `شیمی ${info.name}`, path: info.path }]),
  );
  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <nav aria-label="مسیر" className="mb-6 text-xs text-white/45">
        <Link href="/" className="hover:text-cyan">{s.brand}</Link> / <Link href="/shimi-konkur" className="hover:text-cyan">شیمی کنکور</Link> / <span>شیمی {info.name}</span>
      </nav>
      <p className="mb-3 text-sm font-bold text-cyan">{s.brand} · استاد {s.teacherName}</p>
      <h1 className="section-title mb-6">آموزش <span className="text-gradient">شیمی {info.name}</span></h1>
      <p className="mb-8 max-w-3xl leading-9 text-white/75">{info.intro}</p>
      <div className="mb-12 flex flex-wrap gap-3">
        <Link href={topics.length ? `/courses/${topics[0].id}` : "/courses"} className="btn-primary"><PlayCircle className="size-4" /> شروع با ویدیوی رایگان</Link>
        {s.phone && <a href={`tel:${s.phone}`} className="btn-ghost"><Phone className="size-4" /> کلاس خصوصی شیمی {info.name}</a>}
      </div>

      <h2 className="mb-5 text-2xl font-black">سرفصل‌های شیمی {info.name}</h2>
      <div className="mb-12 grid gap-4">
        {info.chapters.map((c, i) => (
          <section key={c.title} className="card p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black"><BookOpen className="size-5 text-cyan" /> فصل {faNum(i + 1)}: {c.title}</h3>
            <ul className="mb-4 grid list-disc gap-1.5 pr-6 text-white/75 marker:text-cyan sm:grid-cols-2">{c.topics.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="flex items-start gap-2 rounded-2xl bg-amber/10 px-4 py-3 text-sm leading-7 text-white/80"><Lightbulb className="mt-1 size-4 shrink-0 text-amber" /> {c.tip}</p>
          </section>
        ))}
      </div>

      {topics.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-black">ویدیوهای آموزش شیمی {info.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {topics.map((t) => (
              <Link key={t.id} href={`/courses/${t.id}`} className="card flex items-center justify-between p-4 hover:border-cyan/30">
                <span className="font-bold">{t.title}</span>
                <span className="text-xs text-white/50">{faNum(t._count.videos)} ویدیو</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="mb-5 text-2xl font-black">سؤالات متداول شیمی {info.name}</h2>
        <div className="grid gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-bold">{f.q}<ChevronDown className="size-5 shrink-0 text-white/40 transition group-open:rotate-180" /></summary>
              <p className="mt-3 leading-8 text-white/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[...GRADE_LIST.filter((x) => x.key !== g).map((x) => ({ href: x.path, t: `آموزش شیمی ${x.name}` })), { href: "/shimi-konkur", t: "شیمی کنکور" }].map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-center justify-between p-4 font-bold hover:border-cyan/30">{l.t}<ChevronLeft className="size-4 text-white/40" /></Link>
        ))}
      </div>
    </main>
  );
}
