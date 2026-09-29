import type { Metadata } from "next";
import Link from "next/link";
import { UserRound, Users, Megaphone, PlayCircle, FileCheck2, ChevronDown, Phone, ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SITE_URL, breadcrumbLd, faqLd, ldGraph, orgLd, personLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { gradeLabel } from "@/lib/constants";
import { faNum } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetting("site");
  const title = `تدریس شیمی کنکور و دبیرستان در ${s.city} | کلاس خصوصی شیمی با استاد ${s.teacherName}`;
  const description = `تدریس شیمی دهم، یازدهم، دوازدهم و کنکور با استاد ${s.teacherName} در ${s.city}: کلاس خصوصی و گروهی، همایش جمع‌بندی، ویدیوی آموزشی مبحث‌به‌مبحث و آزمون آنلاین — ${s.brand}.`;
  return { title, description, alternates: { canonical: "/tadris-shimi" }, openGraph: { title, description, url: `${SITE_URL}/tadris-shimi` } };
}

export default async function TadrisPage() {
  const s = await getSetting("site");
  const topics = await db.topic.findMany({ where: { published: true }, orderBy: [{ grade: "asc" }, { order: "asc" }], select: { id: true, title: true, grade: true } });
  const faqs = [
    { q: `کلاس خصوصی شیمی استاد ${s.teacherName} چطور برگزار می‌شود؟`, a: `کلاس خصوصی به‌صورت تک‌نفره و متناسب با پایه، رشته و سطح دانش‌آموز برنامه‌ریزی می‌شود. زمان هر جلسه هماهنگ و قبل از کلاس برای دانش‌آموز (و در صورت تمایل والدین) پیامک می‌شود. برای هماهنگی با ${s.phone ? faNum(s.phone) : "پشتیبانی"} تماس بگیرید.` },
    { q: "تدریس شیمی برای چه پایه‌هایی است؟", a: "شیمی دهم، یازدهم و دوازدهم (رشته‌های تجربی و ریاضی) و آمادگی کنکور سراسری، شامل آموزش مفهومی، حل تمرین و تست‌های کنکور." },
    { q: "کلاس گروهی و همایش شیمی هم دارید؟", a: `بله. علاوه بر کلاس خصوصی، کلاس‌های گروهی در آموزشگاه و مدرسه و همایش‌های جمع‌بندی شیمی برگزار می‌شود. اطلاعیه‌ی زمان و مکان در اپلیکیشن ${s.brand} و با پیامک اعلام می‌شود.` },
    { q: "آیا ویدیوی آموزشی شیمی هم هست؟", a: `بله. ویدیوهای تدریس مبحث‌به‌مبحث در اپلیکیشن ${s.brand} قرار دارد و از هر مبحث یک جلسه رایگان است. شاگردان کلاس‌های استاد پس از تأیید به همه‌ی ویدیوها دسترسی دارند.` },
    { q: "پیشرفت دانش‌آموز چطور پیگیری می‌شود؟", a: "هر دانش‌آموز در پنل خود نتیجه‌ی آزمون‌ها، روند پیشرفت یا پسرفت نسبت به گروه، زمان مطالعه و ویدیوهای دیده‌شده را به‌صورت نمودار می‌بیند." },
    { q: `چرا استاد ${s.teacherName}؟`, a: `مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴ و ۵۳ رتبه‌ی دورقمی کنکورهای ۱۴۰۱ تا ۱۴۰۳، طراح آزمون‌های قلم‌چی و خیلی سبز، مؤلف کتاب‌های دوپینگ شیمی و عضو بنیاد ملی نخبگان.` },
  ];
  const ld = ldGraph(
    orgLd(s),
    personLd(s),
    {
      "@type": "Service",
      "@id": `${SITE_URL}/tadris-shimi#service`,
      name: "تدریس شیمی کنکور و دبیرستان",
      serviceType: "تدریس خصوصی و گروهی شیمی",
      provider: { "@id": `${SITE_URL}/#teacher` },
      areaServed: s.city,
      url: `${SITE_URL}/tadris-shimi`,
    },
    faqLd(faqs),
    breadcrumbLd([{ name: s.brand, path: "/" }, { name: "تدریس شیمی", path: "/tadris-shimi" }]),
  );
  const services = [
    { icon: UserRound, t: "کلاس خصوصی شیمی", d: "تک‌نفره، متناسب با سطح و هدف دانش‌آموز؛ از رفع اشکال تا برنامه‌ی کامل کنکور." },
    { icon: Users, t: "کلاس گروهی شیمی", d: "کلاس‌های دهم، یازدهم، دوازدهم و کنکور در مدرسه و آموزشگاه." },
    { icon: Megaphone, t: "همایش جمع‌بندی", d: "همایش‌های نکته و تست و جمع‌بندی شیمی قبل از امتحانات و کنکور." },
    { icon: PlayCircle, t: "ویدیوی آموزشی", d: "تدریس مبحث‌به‌مبحث در اپلیکیشن؛ جلسه‌ی اول هر مبحث رایگان." },
    { icon: FileCheck2, t: "آزمون و کارنامه", d: "آزمون‌های منظم با تحلیل درصد، تراز و مقایسه با گروه." },
  ];
  return (
    <main className="mx-auto max-w-6xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <nav aria-label="مسیر" className="mb-6 text-xs text-white/45"><Link href="/" className="hover:text-cyan">{s.brand}</Link> / <span>تدریس شیمی</span></nav>
      <p className="mb-3 text-sm font-bold text-cyan">{s.brand} · {s.city}</p>
      <h1 className="section-title mb-6">تدریس شیمی کنکور و دبیرستان با <span className="text-gradient">استاد {s.teacherName}</span></h1>
      <p className="mb-8 max-w-3xl leading-9 text-white/75">
        دوپینگ شیمی مجموعه‌ی آموزشی استاد {s.teacherName}، دبیر شیمی دبیرستان هاشمی‌نژاد ۱ {s.city} و مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴ است. تدریس شیمی در اینجا یعنی فهم مفهومی، تسلط بر تست و برنامه‌ی دقیق؛ از شیمی دهم تا جمع‌بندی کنکور.
      </p>
      <div className="mb-14 flex flex-wrap gap-3">
        {s.phone && <a href={`tel:${s.phone}`} className="btn-primary"><Phone className="size-4" /> مشاوره و ثبت‌نام: <span dir="ltr">{faNum(s.phone)}</span></a>}
        <Link href="/login?mode=signup" className="btn-ghost">ثبت‌نام در اپلیکیشن</Link>
      </div>

      <h2 className="mb-5 text-2xl font-black">خدمات آموزشی</h2>
      <div className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((x) => (
          <div key={x.t} className="card p-5"><x.icon className="mb-3 size-8 text-cyan" strokeWidth={1.6} /><h3 className="mb-1 font-black">{x.t}</h3><p className="text-sm leading-7 text-white/65">{x.d}</p></div>
        ))}
      </div>

      {topics.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-5 text-2xl font-black">سرفصل‌های تدریس شیمی</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {["G10", "G11", "G12", "ALL"].map((g) => {
              const list = topics.filter((t) => t.grade === g);
              if (!list.length) return null;
              return (
                <div key={g} className="card p-5">
                  <h3 className="mb-3 font-black">شیمی {gradeLabel(g)}</h3>
                  <ul className="space-y-2 text-sm">{list.map((t) => <li key={t.id}><Link href={`/courses/${t.id}`} className="text-white/75 hover:text-cyan">{t.title}</Link></li>)}</ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-14">
        <h2 className="mb-5 text-2xl font-black">سؤالات متداول درباره‌ی تدریس شیمی</h2>
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
        <p className="font-bold">بیشتر درباره‌ی استاد {s.teacherName} بدانید</p>
        <Link href="/javad-partovi" className="btn-ghost">معرفی و سوابق استاد <ChevronLeft className="size-4" /></Link>
      </div>
    </main>
  );
}
