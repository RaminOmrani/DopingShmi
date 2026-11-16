import type { Metadata } from "next";
import Link from "next/link";
import {
  Award, BadgeCheck, BookOpenCheck, ChevronLeft, FilePenLine, FlaskConical, GraduationCap, History, Medal, MessageSquareWarning, PenTool, Phone, ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { teacherPhoto } from "@/lib/teacher";
import { eduGraph, pageMeta } from "@/lib/page-meta";
import { LD_ID, ldRef } from "@/lib/seo";
import { GRADE_LIST } from "@/lib/syllabus";
import {
  EDITORIAL_ANCHOR, QUIZ_HUB, TEACHER_CREDENTIAL, TOOL_PATHS, chapterLabel, chapterPath, crumbsFor, faslWord, isLive, label as routeLabel, quizPath,
} from "@/lib/site-routes";
import { JsonLd } from "@/components/JsonLd";
import { Reveal } from "@/components/site/Reveal";
import { SocialLinks } from "@/components/site/Footer";
import { Breadcrumbs, Byline, RouteLink } from "@/components/seo/EduChrome";
import { faNum } from "@/lib/utils";

export const revalidate = 300;

const PATH = "/javad-partovi";
/** خط مدرک تحصیلی از فهرست سوابق تنظیمات کنار گذاشته می‌شود تا همیشه متن دقیق TEACHER_CREDENTIAL نمایش داده شود */
const isDegreeLine = (c: string) => /کارشناسی|لیسانس/.test(c);
const icons = [BadgeCheck, BookOpenCheck, PenTool, Award];
const TOOLS = [TOOL_PATHS.formulas, TOOL_PATHS.molarMass, TOOL_PATHS.balance, TOOL_PATHS.ph, TOOL_PATHS.periodic];

const description = (teacher: string, city: string) =>
  `استاد ${teacher}، دبیر شیمی و مدرس شیمی کنکور در ${city} (${TEACHER_CREDENTIAL}): سوابق، رتبه‌های شاگردان و روش تهیه‌ی محتوا.`;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetting("site");
  const city = s.city || "مشهد";
  return pageMeta({ title: `استاد ${s.teacherName}؛ دبیر شیمی کنکور در ${city} | ${s.brand}`, description: description(s.teacherName, city), path: PATH, type: "profile" });
}

export default async function TeacherPage() {
  const s = await getSetting("site");
  const city = s.city || "مشهد";
  const [photo, ranks, articleCount] = await Promise.all([
    teacherPhoto(s),
    db.topRank.findMany({ orderBy: [{ order: "asc" }, { rank: "asc" }], take: 30 }).catch(() => []),
    db.article.count({ where: { published: true } }).catch(() => 0),
  ]);
  const crumbs = crumbsFor(PATH);
  const otherCreds = s.credentials.filter((c) => !isDegreeLine(c));
  const liveTools = TOOLS.filter((p) => isLive(p));
  const ld = eduGraph(s, {
    path: PATH,
    title: `استاد ${s.teacherName}`,
    description: description(s.teacherName, city),
    type: "ProfilePage",
    breadcrumb: crumbs,
    personImage: photo,
    about: ldRef(LD_ID.teacher),
    extra: { mainEntity: ldRef(LD_ID.teacher) },
  });

  return (
    <main className="mx-auto max-w-6xl px-5 pb-10 pt-32">
      <JsonLd data={ld} />
      <Breadcrumbs items={crumbs} />
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_.8fr]">
        <div>
          <p className="mb-3 text-sm font-bold text-cyan">دبیر شیمی · مدرس شیمی کنکور · {city}</p>
          <h1 className="section-title mb-4">
            استاد <span className="text-gradient">{s.teacherName}</span>
          </h1>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/10 px-3 py-1 text-sm font-bold text-cyan">
            <GraduationCap aria-hidden className="size-4" /> {TEACHER_CREDENTIAL}
          </p>
          <p className="mb-6 leading-9 text-white/75">{s.aboutText}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/tadris-shimi" className="btn-primary">
              {routeLabel("/tadris-shimi")} <ChevronLeft aria-hidden className="size-4" />
            </Link>
            <Link href="/courses" className="btn-ghost">ویدیوهای آموزش شیمی</Link>
          </div>
        </div>
        <div className="card glow-border relative mx-auto w-full max-w-sm overflow-hidden p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={`استاد ${s.teacherName}، دبیر شیمی ${city}`} width={352} height={440} className="mx-auto h-[440px] w-auto rounded-[1.25rem] object-contain object-bottom" />
        </div>
      </div>
      <Byline s={s} path={PATH} className="mt-8" />

      <section className="mt-10" aria-labelledby="savabegh">
        <h2 id="savabegh" className="mb-5 text-2xl font-black">سوابق</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card flex items-center gap-4 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/25 text-cyan">
              <GraduationCap aria-hidden className="size-5" />
            </span>
            <span className="font-semibold">{TEACHER_CREDENTIAL}</span>
          </div>
          {otherCreds.map((c, i) => {
            const Icon = icons[i % icons.length];
            return (
              <Reveal key={c} delay={(i + 1) * 0.05}>
                <div className="card flex items-center gap-4 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/25 text-cyan">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="font-semibold">{c}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="rotbe-ha">
        <h2 id="rotbe-ha" className="mb-5 text-2xl font-black">رتبه‌های برتر شاگردان استاد {s.teacherName}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {s.highlights.map((h) => (
            <div key={h.label} className="card p-6 text-center">
              <Medal aria-hidden className="mx-auto mb-2 size-7 text-amber" />
              <p className="text-4xl font-black text-gradient">{faNum(h.value)}</p>
              <p className="mt-2 text-sm text-white/65">{h.label}</p>
            </div>
          ))}
        </div>
        {ranks.length > 0 && (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ranks.map((r) => (
              <li key={r.id} className="card px-4 py-3 text-sm">
                <b>{r.name}</b> — رتبه {faNum(r.rank)} کنکور {faNum(r.year)}
                {r.field ? ` (${r.field})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16" aria-labelledby="mohtava">
        <h2 id="mohtava" className="mb-3 text-2xl font-black">محتوای آموزشی استاد و مجموعه در سایت</h2>
        <p className="mb-5 max-w-3xl leading-9 text-white/75">
          تدریس خود استاد {s.teacherName} در قالب ویدیوهای مبحث‌به‌مبحث در اپلیکیشن {s.brand} است. کنار آن، صفحه‌های آموزشی رایگان سایت را تیم {s.brand} برای
          هر پایه و فصل تهیه می‌کند؛ از راهنمای هر پایه و نقشه‌ی شیمی کنکور تا آزمون‌ها و ابزارهای کمکی.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {GRADE_LIST.map((g) => (
            <div key={g.key} className="card p-5">
              <h3 className="mb-3 font-black">
                <RouteLink path={g.path} className="hover:text-cyan">آموزش شیمی {g.name}</RouteLink>
              </h3>
              <ol className="space-y-2 text-sm leading-7 text-white/70">
                {g.chapters.map((c, i) => {
                  const n = i + 1;
                  return (
                    <li key={c.slug}>
                      <RouteLink path={chapterPath(g.key, n)} className="text-white/80 hover:text-cyan" fallback={<span>فصل {faslWord(n)}: {c.title}</span>}>
                        {chapterLabel(g.key, n)}: {c.title}
                      </RouteLink>
                      <RouteLink path={quizPath(g.key, n)} className="mr-2 text-xs font-bold text-cyan hover:underline" fallback={null}>
                        آزمون آنلاین
                      </RouteLink>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/courses" className="chip hover:border-cyan/40 hover:text-cyan">ویدیوهای آموزش شیمی</Link>
          <Link href="/shimi-konkur" className="chip hover:border-cyan/40 hover:text-cyan">شیمی کنکور</Link>
          <RouteLink path={QUIZ_HUB} className="chip hover:border-cyan/40 hover:text-cyan" fallback={null}>{routeLabel(QUIZ_HUB)}</RouteLink>
          {liveTools.map((p) => (
            <RouteLink key={p} path={p} className="chip hover:border-cyan/40 hover:text-cyan" fallback={null}>{routeLabel(p)}</RouteLink>
          ))}
          {articleCount > 0 && <Link href="/articles" className="chip hover:border-cyan/40 hover:text-cyan">مقاله‌های آموزشی شیمی</Link>}
        </div>
      </section>

      <section id={EDITORIAL_ANCHOR} className="mt-16 scroll-mt-28" aria-labelledby="ravesh-tahie">
        <h2 id="ravesh-tahie" className="mb-3 text-2xl font-black">روش تهیه و بازبینی محتوا</h2>
        <p className="mb-6 max-w-3xl leading-9 text-white/75">
          این بخش توضیح می‌دهد صفحه‌های آموزشی {s.brand} از چه منبعی، توسط چه کسی و چگونه نوشته و بازبینی می‌شوند، تا بدانید به هر صفحه چقدر و چرا می‌توانید اعتماد کنید.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-2 flex items-center gap-2 font-black"><BookOpenCheck aria-hidden className="size-5 text-cyan" /> منبع محتوا</h3>
            <p className="text-sm leading-8 text-white/75">
              مبنای همه‌ی صفحه‌های آموزشی، آخرین چاپ کتاب‌های درسی رسمی شیمی دوره‌ی دوم متوسطه است:{" "}
              {GRADE_LIST.filter((g) => g.book).map((g, i, arr) => (
                <span key={g.key}>
                  {i > 0 && (i === arr.length - 1 ? " و " : "، ")}«
                  <a href={g.book!.url} target="_blank" rel="noopener" className="text-cyan hover:underline">{g.book!.name}</a>»
                </span>
              ))}
              . توضیح‌ها، مثال‌ها و پرسش‌ها نوشته‌ی خود مجموعه است؛ متن، شکل یا پرسش کتاب درسی و آزمون‌های مؤسسه‌های دیگر کپی نمی‌شود.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="mb-2 flex items-center gap-2 font-black"><FilePenLine aria-hidden className="size-5 text-cyan" /> نویسنده و بازبینی</h3>
            <p className="text-sm leading-8 text-white/75">
              متن صفحه‌ها را تیم {s.brand} تهیه می‌کند و در تهیه‌ی پیش‌نویس برخی صفحه‌ها از ابزارهای هوش مصنوعی هم کمک گرفته می‌شود. پیش از انتشار، هر
              گزاره‌ی علمی بازبینی علمی می‌شود، سرفصل‌ها با فهرست کتاب درسی رسمی تطبیق داده می‌شوند و عددها و محاسبه‌ها دوباره حساب می‌شوند. نکته‌هایی که
              ممکن است در چاپ‌های مختلف کتاب فرق کند (مثل نام‌گذاری‌ها و داده‌های جدول‌ها) برای تأیید استاد فهرست می‌شوند و پس از تأیید او یکدست می‌شوند.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="mb-2 flex items-center gap-2 font-black"><ShieldCheck aria-hidden className="size-5 text-cyan" /> امضای بالای صفحه</h3>
            <p className="text-sm leading-8 text-white/75">
              امضای «نوشته و بازبینی علمی: استاد {s.teacherName}» فقط روی صفحه‌هایی می‌آید که استاد خودش خوانده و تأیید کرده است؛ تا آن زمان، نویسنده‌ی صفحه
              «{s.brand}» نوشته می‌شود. کادرهای «نکته استاد» هم فقط متنی است که خود استاد نوشته یا گفته است.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="mb-2 flex items-center gap-2 font-black"><History aria-hidden className="size-5 text-cyan" /> به‌روزرسانی</h3>
            <p className="text-sm leading-8 text-white/75">
              تاریخ «به‌روزرسانی» بالای هر صفحه، زمان آخرین تغییر واقعی محتواست. با هر چاپ تازه‌ی کتاب درسی یا اطلاعیه‌ی رسمی تازه درباره‌ی امتحان نهایی و
              کنکور، صفحه‌های مربوط بازبینی می‌شوند. عددهایی مثل بودجه‌بندی، بارم یا تاریخ آزمون فقط با ذکر منبع رسمی نوشته می‌شوند.
            </p>
          </div>
        </div>
        <div className="card mt-4 flex items-start gap-3 p-5">
          <MessageSquareWarning aria-hidden className="mt-1 size-5 shrink-0 text-amber" />
          <p className="text-sm leading-8 text-white/75">
            <b className="text-white/90">گزارش اشتباه:</b> اگر در یکی از صفحه‌ها اشتباه علمی، غلط تایپی یا پیوند خراب دیدید، نشانی صفحه و توضیح کوتاه را
            {s.telegram && (
              <>
                {" "}در <a href={s.telegram} target="_blank" rel="noopener" className="text-cyan hover:underline">تلگرام</a>
              </>
            )}
            {s.telegram && s.phone ? " یا" : ""}
            {s.phone && (
              <>
                {" "}با شماره‌ی <a href={`tel:${s.phone}`} className="text-cyan hover:underline"><bdi dir="ltr">{faNum(s.phone)}</bdi></a>
              </>
            )}{" "}
            بفرستید. اصلاح‌ها پس از بررسی اعمال می‌شوند و تاریخ به‌روزرسانی همان صفحه تغییر می‌کند.
          </p>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><FlaskConical aria-hidden className="size-5 text-cyan" /> کلاس‌ها و خدمات آموزشی</h2>
          <ul className="list-disc space-y-2 pr-5 leading-8 text-white/75 marker:text-cyan">
            <li>کلاس خصوصی و گروهی شیمی دهم، یازدهم، دوازدهم و کنکور</li>
            <li>همایش‌های جمع‌بندی و نکته و تست شیمی</li>
            <li>
              ویدیوهای آموزشی مبحث‌به‌مبحث در <Link href="/courses" className="text-cyan hover:underline">اپلیکیشن {s.brand}</Link>
            </li>
            <li>آزمون، کارنامه و گزارش پیشرفت برای هر دانش‌آموز</li>
          </ul>
          <Link href="/tadris-shimi" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-cyan">
            جزئیات کلاس خصوصی شیمی در {city} <ChevronLeft aria-hidden className="size-4" />
          </Link>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-xl font-black">ارتباط با استاد {s.teacherName}</h2>
          <p className="mb-4 leading-8 text-white/70">برای مشاوره، ثبت‌نام کلاس خصوصی یا گروهی و اطلاع از زمان همایش‌ها تماس بگیرید.</p>
          {s.phone && (
            <a href={`tel:${s.phone}`} className="btn-primary mb-4">
              <Phone aria-hidden className="size-4" /> <bdi dir="ltr">{faNum(s.phone)}</bdi>
            </a>
          )}
          <SocialLinks site={s} />
          {s.address && <p className="mt-4 text-sm text-white/55">{s.address}</p>}
        </div>
      </section>
    </main>
  );
}
