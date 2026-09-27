import Link from "next/link";
import { db } from "@/lib/db";
import { GRADES, gradeLabel } from "@/lib/constants";
import { faNum, fmtToman } from "@/lib/utils";
import { PlayCircle, Gift, Package } from "lucide-react";

export const metadata = { title: "ویدیوهای آموزشی شیمی" };
export const revalidate = 60;

export default async function Courses() {
  const [topics, bundles] = await Promise.all([
    db.topic.findMany({
      where: { published: true },
      orderBy: [{ grade: "asc" }, { order: "asc" }],
      include: { videos: { where: { published: true }, select: { isFree: true, durationSec: true } } },
    }),
    db.bundle.findMany({ where: { active: true }, orderBy: { order: "asc" }, include: { _count: { select: { topics: true } } } }),
  ]);
  const groups = [...GRADES.map((g) => g.value as string), "ALL"].map((g) => ({ g, items: topics.filter((t) => t.grade === g) })).filter((x) => x.items.length);
  return (
    <main className="mx-auto max-w-7xl px-5 pb-10 pt-32">
      <p className="mb-2 text-sm font-bold text-cyan">ویدیوهای آموزشی</p>
      <h1 className="section-title mb-4">شیمی، <span className="text-gradient">مبحث‌به‌مبحث</span></h1>
      <p className="mb-10 max-w-2xl leading-8 text-white/60">شاگردان کلاس‌های استاد پس از تأیید به همه‌ی ویدیوها دسترسی دارند. بقیه‌ی دوستان می‌توانند از هر مبحث یک جلسه را رایگان ببینند و مبحث یا بسته‌ی جامع را تهیه کنند.</p>

      {bundles.length > 0 && (
        <div className="mb-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => (
            <Link key={b.id} href={`/courses/bundle-${b.id}`} className="card glow-border relative overflow-hidden p-6 transition hover:-translate-y-1">
              <div className="absolute -left-10 -top-10 size-40 rounded-full bg-violet/25 blur-3xl" />
              <Package className="mb-4 size-9 text-cyan" />
              <p className="text-lg font-black">{b.title}</p>
              <p className="mb-4 mt-1 text-sm text-white/55">{faNum(b._count.topics)} مبحث{b.durationDays ? ` · دسترسی ${faNum(b.durationDays)} روزه` : " · دسترسی دائمی"}</p>
              <p className="text-xl font-black text-gradient">{fmtToman(b.price)}</p>
            </Link>
          ))}
        </div>
      )}

      {groups.length === 0 && <div className="card p-16 text-center text-white/50">به‌زودی ویدیوها منتشر می‌شوند.</div>}
      {groups.map(({ g, items }) => (
        <section key={g} className="mb-12">
          <h2 className="mb-5 text-2xl font-black">شیمی {gradeLabel(g)}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => {
              const free = t.videos.filter((v) => v.isFree).length;
              const min = Math.round(t.videos.reduce((s, v) => s + v.durationSec, 0) / 60);
              return (
                <Link key={t.id} href={`/courses/${t.id}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:border-cyan/30">
                  <div className="on-dark relative h-40 overflow-hidden bg-gradient-to-br from-violet/40 via-[#0b1026] to-cyan/20">
                    {t.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    )}
                    <PlayCircle className="absolute inset-0 m-auto size-14 text-white/80 drop-shadow-xl transition group-hover:scale-110" strokeWidth={1.2} />
                    {free > 0 && <span className="chip absolute right-3 top-3 !border-lime/30 !bg-lime/15 !text-lime"><Gift className="size-3" /> جلسه رایگان</span>}
                  </div>
                  <div className="p-5">
                    <p className="mb-1 font-black">{t.title}</p>
                    <p className="text-xs text-white/50">{faNum(t.videos.length)} ویدیو · {faNum(min)} دقیقه</p>
                    {t.price > 0 && <p className="mt-3 text-sm font-bold text-cyan">{fmtToman(t.price)}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
