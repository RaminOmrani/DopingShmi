import Link from "next/link";
import {
  Award, BookOpenCheck, GraduationCap, Sparkles, PlayCircle, LineChart, Trophy, Atom, ChevronLeft, FlaskConical, BadgeCheck, PenTool, Medal, Phone,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { MoleculeCanvas } from "@/components/site/MoleculeCanvas";
import { ConferenceStrip } from "@/components/site/ConferenceStrip";
import { Reveal, CountUp } from "@/components/site/Reveal";
import { SocialLinks } from "@/components/site/Footer";
import { gradeLabel } from "@/lib/constants";
import { faNum } from "@/lib/utils";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { faqLd, ldGraph, orgLd, personLd, websiteLd } from "@/lib/seo";
import { pageMeta } from "@/lib/page-meta";
import { GRADE_LIST } from "@/lib/syllabus";
import { QUIZ_HUB, TEACHER_CREDENTIAL, TOOL_PATHS, chapterPath, faslWord, isLive, label } from "@/lib/site-routes";
import { RouteLink } from "@/components/seo/EduChrome";

export const revalidate = 60;

/** پرسش و پاسخ برند: هم در صفحه دیده می‌شود و هم برای گوگل (FAQPage) — تا «دوپینگ شیمی» با این مجموعه شناخته شود */
const brandFaq = (brand: string, teacher: string) => [
  { q: `${brand} چیست؟`, a: `${brand} نام مجموعه‌ی آموزشی و کتاب‌های شیمی استاد ${teacher}، دبیر شیمی و مدرس شیمی کنکور در مشهد است؛ شامل کلاس خصوصی و گروهی، همایش‌های جمع‌بندی، ویدیوهای آموزشی و آزمون آنلاین شیمی دهم، یازدهم، دوازدهم و کنکور.` },
  { q: `مدرس ${brand} کیست؟`, a: `استاد ${teacher} (${TEACHER_CREDENTIAL})، عضو بنیاد ملی نخبگان، طراح آزمون‌های قلم‌چی و خیلی سبز و مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴.` },
  { q: `اپلیکیشن ${brand} چه امکاناتی دارد؟`, a: "ویدیوهای تدریس مبحث‌به‌مبحث (جلسه‌ی اول هر مبحث رایگان)، آزمون آنلاین با کارنامه، نمودار پیشرفت نسبت به گروه، امتیاز و رتبه‌بندی، و اطلاع‌رسانی کلاس‌ها با پیامک." },
];

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetting("site");
  return pageMeta({ title: s.seoTitle, description: s.seoDescription, path: "/", imageAlt: `${s.brand}، تدریس شیمی با استاد ${s.teacherName}` });
}

/** ابزارها و آزمون (بسته‌های C و D)؛ فقط وقتی live شدند در صفحه‌ی اصلی می‌آیند */
const toolCards = [
  { path: TOOL_PATHS.molarMass, d: "محاسبه‌گر آنلاین و رایگان جرم مولی ترکیب‌ها" },
  { path: TOOL_PATHS.balance, d: "موازنه‌ی آنلاین معادله‌ی واکنش‌های شیمیایی" },
  { path: TOOL_PATHS.ph, d: "ابزار رایگان برای مسئله‌های اسید و باز" },
  { path: TOOL_PATHS.periodic, d: "جدول دوره‌ای عنصرها (جدول تناوبی) به فارسی" },
  { path: TOOL_PATHS.formulas, d: "فرمول‌ها و رابطه‌های شیمی دهم تا دوازدهم" },
  { path: QUIZ_HUB, d: "آزمون آنلاین رایگان شیمی، فصل‌به‌فصل" },
];

const credIcons = [GraduationCap, BadgeCheck, BookOpenCheck, PenTool, Award];

export default async function Home() {
  const [site, conf, teacherPhotos, ranks, topics, articles] = await Promise.all([
    getSetting("site"),
    db.photo.findMany({ where: { section: "CONFERENCE", visible: true }, orderBy: [{ order: "asc" }, { createdAt: "desc" }], take: 40 }),
    db.photo.findMany({ where: { section: "TEACHER", visible: true }, orderBy: { order: "asc" }, take: 1 }),
    db.topRank.findMany({ orderBy: [{ order: "asc" }, { rank: "asc" }], take: 24 }),
    db.topic.findMany({ where: { published: true }, orderBy: [{ grade: "asc" }, { order: "asc" }], include: { _count: { select: { videos: { where: { published: true } } } } } }),
    db.article.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, take: 3, select: { slug: true, title: true, excerpt: true, category: true } }),
  ]);
  const liveTools = toolCards.filter((t) => isLive(t.path));
  const fallback = site.teacherPhoto.startsWith("/images/") && !existsSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", site.teacherPhoto)) ? "/images/teacher-placeholder.svg" : site.teacherPhoto;
  const teacherImg = teacherPhotos[0]?.url || fallback;
  const byGrade = ["G10", "G11", "G12"].map((g) => ({ g, items: topics.filter((t) => t.grade === g) })).filter((x) => x.items.length);

  return (
    <main>
      <JsonLd data={ldGraph(websiteLd(site), orgLd(site), personLd(site, teacherImg), faqLd(brandFaq(site.brand, site.teacherName)))} />
      {/* ───────── HERO ───────── */}
      <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24">
        <div className="grid-bg absolute inset-0 -z-10" />
        <div className="absolute inset-0 -z-10"><MoleculeCanvas /></div>
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="relative z-10 text-center lg:text-right">
            <div className="absolute -inset-10 -z-10 rounded-full bg-ink/60 blur-3xl" />
            {/* بالای صفحه بدون Reveal: تیتر و دکمه‌ها از همان HTML سرور دیده می‌شوند (LCP) */}
            <span className="chip mb-6 !border-cyan/30 !bg-cyan/10 !px-4 !py-1.5 !text-xs !text-cyan">
              <Sparkles className="size-3.5" /> مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴
            </span>
            <h1 className="text-5xl font-black leading-[1.15] tracking-tight md:text-7xl">
              <span className="mb-3 block text-base font-bold tracking-normal text-white/70 md:text-xl">{site.brand} · تدریس شیمی با استاد {site.teacherName}</span>
              <span className="text-shine">{site.heroTitle}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/65 md:text-lg lg:mx-0">{site.heroSubtitle}</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/login" rel="nofollow" className="btn-primary !px-7 !py-4 text-base">
                شروع کن <ChevronLeft className="size-5" />
              </Link>
              <Link href="/courses" className="btn-ghost !px-7 !py-4 text-base">
                <PlayCircle className="size-5 text-cyan" /> ویدیوهای آموزشی
              </Link>
            </div>
            <div className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-3 lg:mx-0">
              {site.highlights.map((h) => (
                <div key={h.label} className="card px-3 py-4 text-center">
                  <CountUp value={h.value} className="block whitespace-nowrap text-[15px] font-black text-gradient sm:text-xl md:text-2xl" />
                  <p className="mt-1 text-[10px] font-semibold leading-5 text-white/55 md:text-xs">{h.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-x-6 bottom-6 top-16 -z-10 animate-pulse-glow rounded-full bg-gradient-to-tr from-cyan/40 via-violet/40 to-magenta/30 blur-3xl" />
            <div className="absolute inset-0 -z-10 m-auto aspect-square w-[92%] rounded-full border border-white/10" />
            <div className="absolute inset-0 -z-10 m-auto aspect-square w-[72%] rounded-full border border-dashed border-cyan/20 animate-spin [animation-duration:40s]" />
            {["C", "O", "N", "H"].map((s, i) => (
              <span key={s} className="glass absolute grid size-12 place-items-center rounded-xl text-sm font-black text-cyan animate-float" style={{ top: `${[18, 60, 30, 78][i]}%`, [i % 2 ? "left" : "right"]: `${[2, 0, 4, 8][i]}%`, animationDelay: `${i * 0.8}s` }}>
                {s}
              </span>
            ))}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={teacherImg}
              alt={`استاد ${site.teacherName}`}
              fetchPriority="high"
              className="relative mx-auto max-h-[70vh] w-auto object-contain drop-shadow-[0_30px_60px_rgba(139,92,246,.35)] [mask-image:linear-gradient(to_bottom,black_75%,transparent)]"
            />
            <div className="glass absolute bottom-8 left-1/2 w-max -translate-x-1/2 rounded-2xl px-5 py-3 text-center">
              <p className="text-lg font-black">استاد {site.teacherName}</p>
              <p className="text-xs text-white/60">دبیر شیمی · عضو بنیاد ملی نخبگان</p>
            </div>
          </div>
        </div>
        <a href="#conferences" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs text-white/40 md:flex">
          <span className="h-10 w-6 rounded-full border border-white/20 p-1"><span className="block h-2 w-full animate-bounce rounded-full bg-cyan" /></span>
        </a>
      </section>

      {/* ───────── CONFERENCES ───────── */}
      <section id="conferences" className="relative py-20">
        <div className="mx-auto mb-10 flex max-w-7xl flex-wrap items-end justify-between gap-4 px-5">
          <Reveal>
            <p className="mb-2 text-sm font-bold text-cyan">لحظه‌های ماندگار</p>
            <h2 className="section-title">همایش‌های <span className="text-gradient">دوپینگ شیمی</span></h2>
          </Reveal>
          <Link href="/gallery" className="btn-ghost btn-sm">مشاهده گالری کامل <ChevronLeft className="size-4" /></Link>
        </div>
        <ConferenceStrip photos={conf.map((p) => ({ id: p.id, url: p.url, thumbUrl: p.thumbUrl, title: p.title, caption: p.caption, eventName: p.eventName }))} />
      </section>

      {/* ───────── ABOUT ───────── */}
      <section id="about" className="relative py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal className="relative order-2 lg:order-1">
            <div className="card glow-border relative overflow-hidden p-2">
              <div className="relative overflow-hidden rounded-[1.25rem] bg-gradient-to-b from-deep via-night to-ink">
                {/* پس‌زمینه‌ی ثابت به‌جای بوم دوم مولکول‌ها (فقط یک MoleculeCanvas در صفحه، در هیرو) */}
                <div className="grid-bg absolute inset-0 opacity-60" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={teacherImg} alt={`استاد ${site.teacherName}`} className="relative mx-auto h-[520px] w-auto object-contain object-bottom" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
              </div>
            </div>
            <div className="glass absolute -bottom-6 right-6 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl">
              <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-amber to-rose text-ink"><Trophy className="size-6" /></div>
              <div>
                <p className="text-sm font-black">رتبه ۱۰ کنکور ۱۴۰۴</p>
                <p className="text-xs text-white/55">از شاگردان کلاس</p>
              </div>
            </div>
          </Reveal>
          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="mb-2 text-sm font-bold text-cyan">درباره استاد</p>
              <h2 className="section-title mb-6">{site.aboutTitle}</h2>
              <p className="mb-8 leading-9 text-white/70">{site.aboutText}</p>
            </Reveal>
            <div className="grid gap-3">
              {site.credentials.map((c, i) => {
                const Icon = credIcons[i % credIcons.length];
                return (
                  <Reveal key={c} delay={i * 0.07}>
                    <div className="card flex items-center gap-4 px-4 py-3.5 transition hover:border-cyan/30">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/25 text-cyan"><Icon className="size-5" /></span>
                      <span className="text-sm font-semibold text-white/85">{c}</span>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── RANKS ───────── */}
      <section id="ranks" className="relative py-20">
        <div className="mx-auto max-w-7xl px-5">
          <Reveal className="mb-12 text-center">
            <p className="mb-2 text-sm font-bold text-cyan">نتیجه، بهترین معرفی است</p>
            <h2 className="section-title">رتبه‌های <span className="text-gradient">برتر</span></h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {[{ r: "10", t: "رتبه ۱۰ کنکور ۱۴۰۴" }, { r: "38", t: "رتبه ۳۸ کنکور ۱۴۰۴" }, { r: "108", t: "رتبه ۱۰۸ کنکور ۱۴۰۴" }].map((x, i) => (
              <Reveal key={x.r} delay={i * 0.1}>
                <div className="card glow-border group relative overflow-hidden p-8 text-center">
                  <div className="absolute -top-20 left-1/2 size-48 -translate-x-1/2 rounded-full bg-violet/20 blur-3xl transition group-hover:bg-cyan/25" />
                  <Medal className="mx-auto mb-3 size-8 text-amber" />
                  <p className="text-7xl font-black text-gradient md:text-8xl">{faNum(x.r)}</p>
                  <p className="mt-3 font-bold text-white/75">{x.t}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Reveal><div className="card flex items-center gap-5 p-6"><span className="text-5xl font-black text-gradient">{faNum(53)}</span><p className="text-white/70">رتبه‌ی <b className="text-white">دورقمی</b> در کنکورهای ۱۴۰۱، ۱۴۰۲ و ۱۴۰۳</p></div></Reveal>
            <Reveal delay={0.1}><div className="card flex items-center gap-5 p-6"><span className="text-5xl font-black text-gradient">+{faNum(200)}</span><p className="text-white/70">رتبه‌ی <b className="text-white">زیر ۱۰۰۰</b> کنکور سراسری</p></div></Reveal>
          </div>

          {ranks.length > 0 && (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {ranks.map((r, i) => (
                <Reveal key={r.id} delay={(i % 6) * 0.05}>
                  <div className="card overflow-hidden text-center transition hover:-translate-y-1">
                    <div className="relative h-32 bg-gradient-to-br from-violet/30 to-cyan/10">
                      {r.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photo} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Atom className="absolute inset-0 m-auto size-12 text-white/20" />
                      )}
                      <span className="on-dark absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-0.5 text-xs font-black text-amber">رتبه {faNum(r.rank)}</span>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-bold">{r.name}</p>
                      <p className="text-[11px] text-white/50">{r.field ? `${r.field} · ` : ""}{faNum(r.year)}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ───────── APP FEATURES ───────── */}
      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-5">
          <Reveal className="mb-12 text-center">
            <p className="mb-2 text-sm font-bold text-cyan">اپلیکیشن دوپینگ شیمی</p>
            <h2 className="section-title">هر چیزی که برای <span className="text-gradient">۱۰۰ زدن</span> لازم داری</h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: PlayCircle, t: "ویدیو مبحث‌به‌مبحث", d: "تدریس کامل هر مبحث با کیفیت بالا؛ از هر مبحث یک جلسه رایگان.", c: "from-cyan/25" },
              { icon: FlaskConical, t: "آزمون و کارنامه", d: "آزمون‌های استاندارد با تحلیل درصد، تراز و مقایسه با گروه.", c: "from-violet/25" },
              { icon: LineChart, t: "نمودار پیشرفت", d: "روند نمره‌ها، زمان مطالعه و ویدیوهای دیده‌شده؛ روزبه‌روز.", c: "from-magenta/25" },
              { icon: Trophy, t: "امتیاز و سطح", d: "با هر فعالیت امتیاز بگیر و از هیدروژن تا طلا بالا برو!", c: "from-amber/25" },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 0.08}>
                <div className={`card h-full bg-gradient-to-b ${f.c} to-transparent p-6 transition hover:-translate-y-1.5`}>
                  <f.icon className="mb-5 size-10 text-white" strokeWidth={1.5} />
                  <p className="mb-2 text-lg font-black">{f.t}</p>
                  <p className="text-sm leading-7 text-white/60">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── COURSES ───────── */}
      {byGrade.length > 0 && (
        <section className="relative py-20">
          <div className="mx-auto max-w-7xl px-5">
            <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-sm font-bold text-cyan">ویدیوهای آموزشی</p>
                <h2 className="section-title">مباحث <span className="text-gradient">شیمی</span></h2>
              </div>
              <Link href="/courses" className="btn-ghost btn-sm">همه مباحث <ChevronLeft className="size-4" /></Link>
            </Reveal>
            <div className="grid gap-4 lg:grid-cols-3">
              {byGrade.map(({ g, items }, i) => (
                <Reveal key={g} delay={i * 0.1}>
                  <div className="card h-full p-6">
                    <p className="mb-4 text-xl font-black">شیمی {gradeLabel(g)}</p>
                    <div className="space-y-2">
                      {items.slice(0, 6).map((t) => (
                        <Link key={t.id} href={`/courses/${t.id}`} className="flex items-center justify-between rounded-xl bg-white/[.03] px-4 py-3 text-sm transition hover:bg-white/[.07]">
                          <span className="font-semibold">{t.title}</span>
                          <span className="text-xs text-white/45">{faNum(t._count.videos)} ویدیو</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── آموزش شیمی: پایه‌ها، فصل‌ها، ابزارها (پیوندهای قابل خزش به صفحه‌های آموزشی) ───────── */}
      <section id="amoozesh-shimi" className="relative py-20">
        <div className="mx-auto max-w-7xl px-5">
          <Reveal className="mb-10 text-center">
            <p className="mb-2 text-sm font-bold text-cyan">آموزش شیمی</p>
            <h2 className="section-title">آموزش شیمی دهم، یازدهم و <span className="text-gradient">دوازدهم</span></h2>
            <p className="mx-auto mt-4 max-w-2xl leading-8 text-white/60">
              سرفصل هر فصل کتاب درسی، نکته‌های مهم و مسیر مطالعه؛ از پایه‌ی دهم تا جمع‌بندی <Link href="/shimi-konkur" className="text-cyan hover:underline">شیمی کنکور</Link>.
            </p>
          </Reveal>
          <div className="grid gap-4 lg:grid-cols-3">
            {GRADE_LIST.map((g, i) => (
              <Reveal key={g.key} delay={i * 0.1}>
                <div className="card h-full p-6">
                  <Link href={g.path} className="group mb-4 flex items-center justify-between gap-3">
                    <span className="text-xl font-black group-hover:text-cyan">آموزش شیمی {g.name}</span>
                    <span className="flex items-center gap-1 text-xs text-white/45">{faNum(g.chapters.length)} فصل <ChevronLeft className="size-4" /></span>
                  </Link>
                  <ol className="space-y-2">
                    {g.chapters.map((c, n) => (
                      <li key={c.slug}>
                        {/* تا صفحه‌ی فصل live نشده، همین متن بدون پیوند نمایش داده می‌شود */}
                        <RouteLink path={chapterPath(g.key, n + 1)} className="flex items-baseline gap-2 rounded-xl bg-white/[.03] px-4 py-3 text-sm transition hover:bg-white/[.07]">
                          <span className="shrink-0 text-xs font-bold text-cyan">فصل {faslWord(n + 1)}</span>
                          <span className="font-semibold">{c.title}</span>
                        </RouteLink>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            ))}
          </div>
          {liveTools.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liveTools.map((t) => (
                <RouteLink key={t.path} path={t.path} fallback={null} className="group card flex items-center justify-between gap-3 p-5 transition hover:border-cyan/30">
                  <span>
                    <span className="block font-black group-hover:text-cyan">{label(t.path)}</span>
                    <span className="mt-1 block text-xs leading-6 text-white/55">{t.d}</span>
                  </span>
                  <ChevronLeft className="size-4 shrink-0 text-white/40" />
                </RouteLink>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ───────── آخرین مقاله‌ها (فقط وقتی مقاله‌ی منتشرشده هست) ───────── */}
      {articles.length > 0 && (
        <section className="relative py-20">
          <div className="mx-auto max-w-7xl px-5">
            <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-sm font-bold text-cyan">مقاله‌ها</p>
                <h2 className="section-title">آخرین مقاله‌های <span className="text-gradient">آموزشی</span></h2>
              </div>
              <Link href="/articles" className="btn-ghost btn-sm">همه مقاله‌ها <ChevronLeft className="size-4" /></Link>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              {articles.map((a, i) => (
                <Reveal key={a.slug} delay={i * 0.08}>
                  <Link href={`/articles/${encodeURIComponent(a.slug)}`} className="card group block h-full p-6 transition hover:-translate-y-1 hover:border-cyan/30">
                    {a.category && <p className="mb-1 text-xs font-bold text-cyan">{a.category}</p>}
                    <h3 className="mb-2 font-black leading-8 group-hover:text-cyan">{a.title}</h3>
                    {a.excerpt && <p className="line-clamp-3 text-sm leading-7 text-white/60">{a.excerpt}</p>}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── دوپینگ شیمی چیست + مسیرهای آموزشی ───────── */}
      <section className="relative py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <div className="card h-full p-7">
              <p className="mb-2 text-sm font-bold text-cyan">درباره‌ی برند</p>
              <h2 className="mb-5 text-2xl font-black md:text-3xl">درباره‌ی {site.brand}</h2>
              <div className="space-y-4">
                {brandFaq(site.brand, site.teacherName).map((f) => (
                  <div key={f.q}>
                    <h3 className="mb-1 font-black">{f.q}</h3>
                    <p className="text-sm leading-8 text-white/70">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card h-full p-7">
              <p className="mb-2 text-sm font-bold text-cyan">مسیرهای آموزشی</p>
              <h2 className="mb-5 text-2xl font-black md:text-3xl">آموزش و تدریس شیمی</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { href: "/shimi-konkur", t: "شیمی کنکور", d: "سرفصل‌ها، روش مطالعه و مسیر آمادگی" },
                  { href: "/tadris-shimi", t: "کلاس خصوصی شیمی", d: `کلاس خصوصی، گروهی و همایش در ${site.city}` },
                  { href: "/courses", t: "ویدیوهای آموزش شیمی", d: "تدریس مبحث‌به‌مبحث؛ از هر مبحث یک جلسه رایگان" },
                  { href: QUIZ_HUB, t: "آزمون آنلاین شیمی", d: "آزمون رایگان هر فصل" },
                  ...(articles.length > 0 ? [{ href: "/articles", t: "مقالات آموزشی", d: "روش مطالعه و نکته‌های تستی" }] : []),
                  { href: "/javad-partovi", t: `استاد ${site.teacherName}`, d: "سوابق و روش تدریس" },
                ]
                  .filter((l) => isLive(l.href))
                  .map((l) => (
                    <RouteLink key={l.href} path={l.href} fallback={null} className="group rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:border-cyan/30 hover:bg-white/[.06]">
                      <span className="flex items-center justify-between font-black group-hover:text-cyan">{l.t}<ChevronLeft className="size-4 text-white/40" /></span>
                      <span className="mt-1 block text-xs text-white/50">{l.d}</span>
                    </RouteLink>
                  ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── CTA + CONTACT ───────── */}
      <section id="contact" className="relative py-20">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <div className="card glow-border relative overflow-hidden p-8 text-center md:p-14">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan/15 via-violet/15 to-magenta/10" />
              <h2 className="section-title mb-4">آماده‌ای شیمی رو <span className="text-gradient">دوپینگ</span> کنی؟</h2>
              <p className="mx-auto mb-8 max-w-xl leading-8 text-white/65">
                با شماره موبایلت ثبت‌نام کن. اگه شاگرد کلاس‌های استاد هستی، بعد از تأیید به همه‌ی ویدیوها و آزمون‌ها دسترسی داری؛ وگرنه می‌تونی هر مبحث رو جدا تهیه کنی.
              </p>
              <div className="mb-10 flex flex-wrap justify-center gap-3">
                <Link href="/login?mode=signup" rel="nofollow" className="btn-primary !px-8 !py-4 text-base">ثبت‌نام رایگان</Link>
                {site.phone && <a href={`tel:${site.phone}`} className="btn-ghost !px-8 !py-4 text-base"><Phone className="size-5 text-emerald-300" /> <span dir="ltr">{faNum(site.phone)}</span></a>}
              </div>
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-white/50">ارتباط مستقیم</p>
                <SocialLinks site={site} size="lg" />
                {site.address && <p className="mt-3 text-sm text-white/55">{site.address}</p>}
                {site.mapUrl && <a href={site.mapUrl} target="_blank" rel="noopener" className="text-sm text-cyan hover:underline">مسیریابی روی نقشه</a>}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
