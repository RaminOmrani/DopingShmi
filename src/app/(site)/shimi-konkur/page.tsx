import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronLeft, Phone, Target, Timer, BookOpenCheck, LineChart, AlertTriangle } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { SITE_URL, breadcrumbLd, faqLd, ldGraph, orgLd, personLd } from "@/lib/seo";
import { GRADE_LIST } from "@/lib/syllabus";
import { JsonLd } from "@/components/JsonLd";
import { faNum } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetting("site");
  const title = `شیمی کنکور | آموزش و تدریس شیمی کنکور تجربی و ریاضی با استاد ${s.teacherName}`;
  const description = `راهنمای کامل شیمی کنکور: سرفصل‌های شیمی دهم، یازدهم و دوازدهم، روش مطالعه، برنامه‌ی جمع‌بندی و تست‌زنی، همراه با کلاس، همایش و ویدیوهای آموزشی استاد ${s.teacherName} — ${s.brand}.`;
  return { title: { absolute: title }, description, alternates: { canonical: "/shimi-konkur" }, openGraph: { title, description, url: `${SITE_URL}/shimi-konkur` } };
}

export default async function KonkurPage() {
  const s = await getSetting("site");
  const steps = [
    { icon: BookOpenCheck, t: "پایه‌سازی مفهومی", d: "هر سه کتاب را فصل‌به‌فصل با درسنامه و متن کتاب درسی بخوانید. هدف این مرحله فهم «چرا»ی هر نکته است، نه سرعت." },
    { icon: Target, t: "تست آموزشی و مبحثی", d: "بعد از هر درسنامه تست آموزشی بدون محدودیت زمان، و در پایان هر فصل تست مبحثی زمان‌دار بزنید." },
    { icon: Timer, t: "آزمون جامع و زمان‌دار", d: "با نزدیک شدن به کنکور، آزمون‌های جامع زمان‌دار و مدیریت زمان سر جلسه را تمرین کنید." },
    { icon: LineChart, t: "تحلیل و جمع‌بندی", d: "اشتباه‌ها را دسته‌بندی کنید (مفهومی، بی‌دقتی، زمان، حفظی) و جمع‌بندی را روی نقطه‌های ضعف متمرکز کنید." },
  ];
  const mistakes = [
    "تست زدن قبل از فهم کامل درسنامه",
    "نادیده گرفتن متن، جدول‌ها و شکل‌های کتاب درسی",
    "تمرین نکردن مسئله‌ها به‌صورت روزانه",
    "ننوشتن واحدها در محاسبات استوکیومتری",
    "آزمون دادن بدون تحلیل اشتباه‌ها",
  ];
  const faqs = [
    { q: "شیمی کنکور از چه کتاب‌هایی است؟", a: "شیمی کنکور از سه کتاب شیمی دهم، یازدهم و دوازدهم طرح می‌شود. رشته‌های تجربی و ریاضی هر دو شیمی را در کنکور دارند." },
    { q: "شیمی کنکور را از کجا شروع کنیم؟", a: "اگر پایه‌ی ضعیفی دارید از شیمی دهم شروع کنید، چون مفاهیم مول، آرایش الکترونی، استوکیومتری و محلول‌ها در هر سه کتاب تکرار می‌شوند. هم‌زمان شیمی پایه‌ی جاری را هم عقب نیندازید." },
    { q: "برای شیمی کنکور تست بزنیم یا درسنامه بخوانیم؟", a: "هر دو، به ترتیب: اول درسنامه و فهم مفهوم، بعد تست آموزشی، سپس تست مبحثی و جامع زمان‌دار. تست بدون مفهوم با کمی تغییر صورت سؤال در کنکور جواب نمی‌دهد." },
    { q: `کلاس شیمی کنکور استاد ${s.teacherName} چگونه است؟`, a: `کلاس خصوصی تک‌نفره و کلاس گروهی شیمی کنکور، همایش‌های جمع‌بندی و ویدیوهای مبحث‌به‌مبحث در اپلیکیشن ${s.brand}. استاد ${s.teacherName} مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴ و طراح آزمون‌های قلم‌چی و خیلی سبز است.` },
  ];
  const ld = ldGraph(
    orgLd(s),
    personLd(s),
    {
      "@type": "Course",
      "@id": `${SITE_URL}/shimi-konkur#course`,
      name: "آموزش شیمی کنکور",
      description: "آموزش شیمی کنکور تجربی و ریاضی: شیمی دهم، یازدهم و دوازدهم، تست‌زنی و جمع‌بندی.",
      url: `${SITE_URL}/shimi-konkur`,
      inLanguage: "fa-IR",
      provider: { "@id": `${SITE_URL}/#org` },
      instructor: { "@id": `${SITE_URL}/#teacher` },
      hasPart: GRADE_LIST.map((g) => ({ "@type": "Course", name: `آموزش شیمی ${g.name}`, url: `${SITE_URL}${g.path}` })),
    },
    faqLd(faqs),
    breadcrumbLd([{ name: s.brand, path: "/" }, { name: "شیمی کنکور", path: "/shimi-konkur" }]),
  );
  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <nav aria-label="مسیر" className="mb-6 text-xs text-white/45"><Link href="/" className="hover:text-cyan">{s.brand}</Link> / <span>شیمی کنکور</span></nav>
      <p className="mb-3 text-sm font-bold text-cyan">{s.brand} · استاد {s.teacherName}</p>
      <h1 className="section-title mb-6">آموزش <span className="text-gradient">شیمی کنکور</span> تجربی و ریاضی</h1>
      <p className="mb-8 max-w-3xl leading-9 text-white/75">
        شیمی کنکور ترکیبی از مفهوم، حفظیات کتاب درسی و مسئله‌های محاسباتی است و با برنامه‌ی درست، یکی از قابل‌پیش‌بینی‌ترین درس‌های کنکور می‌شود. در این صفحه سرفصل‌ها، روش مطالعه و مسیر آمادگی شیمی کنکور را از نگاه استاد {s.teacherName}، مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴ و طراح آزمون‌های قلم‌چی و خیلی سبز، می‌خوانید.
      </p>
      <div className="mb-12 flex flex-wrap gap-3">
        <Link href="/tadris-shimi" className="btn-primary">کلاس و تدریس شیمی کنکور <ChevronLeft className="size-4" /></Link>
        {s.phone && <a href={`tel:${s.phone}`} className="btn-ghost"><Phone className="size-4" /> مشاوره: <span dir="ltr">{faNum(s.phone)}</span></a>}
      </div>

      <h2 className="mb-5 text-2xl font-black">سرفصل‌های شیمی کنکور</h2>
      <div className="mb-12 grid gap-4 md:grid-cols-3">
        {GRADE_LIST.map((g) => (
          <Link key={g.key} href={g.path} className="card group p-5 transition hover:-translate-y-1 hover:border-cyan/30">
            <h3 className="mb-3 font-black group-hover:text-cyan">شیمی {g.name}</h3>
            <ol className="mb-3 list-decimal space-y-1.5 pr-5 text-sm leading-7 text-white/70 marker:text-cyan">{g.chapters.map((c) => <li key={c.title}>{c.title}</li>)}</ol>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan">آموزش شیمی {g.name} <ChevronLeft className="size-3" /></span>
          </Link>
        ))}
      </div>

      <h2 className="mb-5 text-2xl font-black">مسیر آمادگی شیمی کنکور در ۴ مرحله</h2>
      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        {steps.map((x, i) => (
          <div key={x.t} className="card p-5">
            <x.icon className="mb-3 size-8 text-cyan" strokeWidth={1.6} />
            <h3 className="mb-1 font-black">{faNum(i + 1)}. {x.t}</h3>
            <p className="text-sm leading-7 text-white/65">{x.d}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-5 text-2xl font-black">اشتباه‌های رایج در مطالعه‌ی شیمی کنکور</h2>
      <ul className="card mb-12 grid gap-3 p-6">
        {mistakes.map((m) => <li key={m} className="flex items-start gap-2 text-white/75"><AlertTriangle className="mt-1 size-4 shrink-0 text-amber" /> {m}</li>)}
      </ul>

      <section className="mb-12">
        <h2 className="mb-5 text-2xl font-black">سؤالات متداول شیمی کنکور</h2>
        <div className="grid gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-bold">{f.q}<ChevronDown className="size-5 shrink-0 text-white/40 transition group-open:rotate-180" /></summary>
              <p className="mt-3 leading-8 text-white/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="card glow-border flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-bold">شیمی کنکور با استاد {s.teacherName}</p>
          <p className="text-sm text-white/55">کلاس خصوصی، کلاس گروهی، همایش جمع‌بندی و ویدیوهای آموزشی</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/javad-partovi" className="btn-ghost btn-sm">معرفی استاد</Link>
          <Link href="/courses" className="btn-primary btn-sm">ویدیوهای آموزشی</Link>
        </div>
      </div>
    </main>
  );
}
