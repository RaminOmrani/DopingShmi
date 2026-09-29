import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, BadgeCheck, BookOpenCheck, PenTool, Award, Medal, ChevronLeft, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { teacherPhoto } from "@/lib/teacher";
import { SITE_URL, breadcrumbLd, ldGraph, orgLd, personLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { Reveal } from "@/components/site/Reveal";
import { SocialLinks } from "@/components/site/Footer";
import { faNum } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetting("site");
  const title = `استاد ${s.teacherName} | دبیر شیمی و مدرس شیمی کنکور در ${s.city}`;
  const description = `معرفی استاد ${s.teacherName}، دبیر شیمی دبیرستان هاشمی‌نژاد ۱ ${s.city}، عضو بنیاد ملی نخبگان، مؤلف کتاب‌های دوپینگ شیمی و مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴.`;
  return { title, description, alternates: { canonical: "/javad-partovi" }, openGraph: { title, description, url: `${SITE_URL}/javad-partovi`, type: "profile" } };
}

const icons = [GraduationCap, BadgeCheck, BookOpenCheck, PenTool, Award];

export default async function TeacherPage() {
  const s = await getSetting("site");
  const [photo, ranks] = await Promise.all([teacherPhoto(s), db.topRank.findMany({ orderBy: [{ order: "asc" }, { rank: "asc" }], take: 30 })]);
  const ld = ldGraph(
    { ...personLd(s, photo), mainEntityOfPage: `${SITE_URL}/javad-partovi` },
    orgLd(s),
    { "@type": "ProfilePage", "@id": `${SITE_URL}/javad-partovi`, url: `${SITE_URL}/javad-partovi`, name: `استاد ${s.teacherName}`, mainEntity: { "@id": `${SITE_URL}/#teacher` } },
    breadcrumbLd([{ name: s.brand, path: "/" }, { name: `استاد ${s.teacherName}`, path: "/javad-partovi" }]),
  );
  return (
    <main className="mx-auto max-w-6xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <nav aria-label="مسیر" className="mb-6 text-xs text-white/45"><Link href="/" className="hover:text-cyan">{s.brand}</Link> / <span>استاد {s.teacherName}</span></nav>
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_.8fr]">
        <div>
          <p className="mb-3 text-sm font-bold text-cyan">دبیر شیمی · مدرس شیمی کنکور · {s.city}</p>
          <h1 className="section-title mb-6">استاد <span className="text-gradient">{s.teacherName}</span></h1>
          <p className="mb-8 leading-9 text-white/75">{s.aboutText}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/tadris-shimi" className="btn-primary">کلاس‌ها و تدریس شیمی <ChevronLeft className="size-4" /></Link>
            <Link href="/courses" className="btn-ghost">ویدیوهای آموزشی</Link>
          </div>
        </div>
        <div className="card glow-border relative mx-auto w-full max-w-sm overflow-hidden p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={`استاد ${s.teacherName}، دبیر شیمی ${s.city}`} className="mx-auto h-[440px] w-auto rounded-[1.25rem] object-contain object-bottom" />
        </div>
      </div>

      <section className="mt-16">
        <h2 className="mb-5 text-2xl font-black">سوابق و افتخارات</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {s.credentials.map((c, i) => {
            const Icon = icons[i % icons.length];
            return (
              <Reveal key={c} delay={i * 0.05}>
                <div className="card flex items-center gap-4 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/25 text-cyan"><Icon className="size-5" /></span><span className="font-semibold">{c}</span></div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="mb-5 text-2xl font-black">رتبه‌های برتر شاگردان استاد {s.teacherName}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {s.highlights.map((h) => (
            <div key={h.label} className="card p-6 text-center"><Medal className="mx-auto mb-2 size-7 text-amber" /><p className="text-4xl font-black text-gradient">{h.value}</p><p className="mt-2 text-sm text-white/65">{h.label}</p></div>
          ))}
        </div>
        {ranks.length > 0 && (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ranks.map((r) => <li key={r.id} className="card px-4 py-3 text-sm"><b>{r.name}</b> — رتبه {faNum(r.rank)} کنکور {faNum(r.year)}{r.field ? ` (${r.field})` : ""}</li>)}
          </ul>
        )}
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 text-xl font-black">کلاس‌ها و خدمات آموزشی</h2>
          <ul className="list-disc space-y-2 pr-5 leading-8 text-white/75 marker:text-cyan">
            <li>کلاس خصوصی و گروهی شیمی دهم، یازدهم، دوازدهم و کنکور</li>
            <li>همایش‌های جمع‌بندی و نکته و تست شیمی</li>
            <li>ویدیوهای آموزشی مبحث‌به‌مبحث در <Link href="/courses" className="text-cyan hover:underline">اپلیکیشن دوپینگ شیمی</Link></li>
            <li>آزمون، کارنامه و گزارش پیشرفت برای هر دانش‌آموز</li>
          </ul>
          <Link href="/tadris-shimi" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-cyan">جزئیات تدریس شیمی <ChevronLeft className="size-4" /></Link>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-xl font-black">ارتباط با استاد {s.teacherName}</h2>
          <p className="mb-4 leading-8 text-white/70">برای مشاوره، ثبت‌نام کلاس خصوصی یا گروهی و اطلاع از زمان همایش‌ها تماس بگیرید.</p>
          {s.phone && <a href={`tel:${s.phone}`} className="btn-primary mb-4"><Phone className="size-4" /> <span dir="ltr">{faNum(s.phone)}</span></a>}
          <SocialLinks site={s} />
          {s.address && <p className="mt-4 text-sm text-white/55">{s.address}</p>}
        </div>
      </section>
    </main>
  );
}
