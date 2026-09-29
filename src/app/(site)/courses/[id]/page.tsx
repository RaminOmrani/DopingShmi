import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, PlayCircle, Gift, CheckCircle2, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getAccess, canWatch } from "@/lib/access";
import { BuyButton } from "@/components/BuyButton";
import { gradeLabel } from "@/lib/constants";
import { faNum, fmtClock, fmtToman, fmtDate } from "@/lib/utils";
import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { SITE_URL, breadcrumbLd, ldGraph } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await getSetting("site");
  const item: { title: string; description: string | null; grade?: string } | null = id.startsWith("bundle-")
    ? await db.bundle.findUnique({ where: { id: id.slice(7) }, select: { title: true, description: true } })
    : await db.topic.findUnique({ where: { id }, select: { title: true, description: true, grade: true } });
  if (!item) return {};
  const title = item.grade ? `${item.title} — آموزش شیمی ${gradeLabel(item.grade)}` : item.title;
  const description = item.description || `${title} با تدریس استاد ${s.teacherName} در ${s.brand}. جلسه‌ی اول رایگان.`;
  return { title, description, alternates: { canonical: `/courses/${id}` }, openGraph: { title, description, url: `${SITE_URL}/courses/${id}` } };
}

function courseLd(id: string, name: string, description: string | null, brand: string) {
  return ldGraph(
    {
      "@type": "Course",
      name,
      description: description || name,
      url: `${SITE_URL}/courses/${id}`,
      inLanguage: "fa-IR",
      provider: { "@type": "EducationalOrganization", name: brand, url: SITE_URL },
      instructor: { "@id": `${SITE_URL}/#teacher` },
    },
    breadcrumbLd([{ name: brand, path: "/" }, { name: "ویدیوهای آموزشی", path: "/courses" }, { name, path: `/courses/${id}` }]),
  );
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const access = await getAccess(user);
  const site = await getSetting("site");

  if (id.startsWith("bundle-")) {
    const b = await db.bundle.findUnique({ where: { id: id.slice(7) }, include: { topics: { where: { published: true }, orderBy: [{ grade: "asc" }, { order: "asc" }], include: { _count: { select: { videos: true } } } } } });
    if (!b || !b.active) notFound();
    const owned = b.topics.length > 0 && b.topics.every((t) => access.all || access.topicIds.has(t.id));
    return (
      <main className="mx-auto max-w-4xl px-5 pb-10 pt-32">
        <JsonLd data={courseLd(id, b.title, b.description, site.brand)} />
        <p className="mb-2 text-sm font-bold text-cyan">بسته جامع</p>
        <h1 className="section-title mb-4">{b.title}</h1>
        {b.description && <p className="mb-6 leading-8 text-white/65">{b.description}</p>}
        <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-2xl font-black text-gradient">{fmtToman(b.price)}</p>
            <p className="text-sm text-white/55">{b.durationDays ? `دسترسی ${faNum(b.durationDays)} روزه` : "دسترسی دائمی"} · {faNum(b.topics.length)} مبحث</p>
          </div>
          {owned ? <span className="chip !text-lime"><CheckCircle2 className="size-4" /> در دسترس شما</span> : <BuyButton type="BUNDLE" id={b.id} loggedIn={!!user} />}
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

  const topic = await db.topic.findUnique({
    where: { id },
    include: { videos: { where: { published: true }, orderBy: { order: "asc" } }, bundles: { where: { active: true } } },
  });
  if (!topic || !topic.published) notFound();
  const owned = access.all || access.topicIds.has(topic.id);
  const expires = access.expires.get(topic.id);
  const progress = user ? await db.videoProgress.findMany({ where: { userId: user.id, videoId: { in: topic.videos.map((v) => v.id) } } }) : [];
  const done = new Set(progress.filter((p) => p.completed).map((p) => p.videoId));

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-32">
      <JsonLd data={courseLd(id, `${topic.title} — شیمی ${gradeLabel(topic.grade)}`, topic.description, site.brand)} />
      <Link href="/courses" className="mb-4 inline-block text-sm text-white/50 hover:text-cyan">← همه مباحث</Link>
      <p className="mb-2 text-sm font-bold text-cyan">شیمی {gradeLabel(topic.grade)}</p>
      <h1 className="section-title mb-4">{topic.title}</h1>
      {topic.description && <p className="mb-6 max-w-3xl leading-8 text-white/65">{topic.description}</p>}

      <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-6">
        {owned ? (
          <div className="flex items-center gap-3 text-lime">
            <CheckCircle2 className="size-6" />
            <div>
              <p className="font-black">این مبحث برای شما باز است</p>
              {expires && <p className="text-xs text-white/55">دسترسی تا {fmtDate(expires)}</p>}
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-white/55">دسترسی کامل به {faNum(topic.videos.length)} ویدیوی این مبحث</p>
              {topic.price > 0 ? <p className="text-2xl font-black text-gradient">{fmtToman(topic.price)}</p> : <p className="text-sm text-white/60">فروش تکی این مبحث فعال نیست؛ بسته‌های جامع را ببینید.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {topic.price > 0 && <BuyButton type="TOPIC" id={topic.id} loggedIn={!!user} />}
              {topic.bundles.map((b) => (
                <Link key={b.id} href={`/courses/bundle-${b.id}`} className="btn-ghost">بسته «{b.title}»</Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3">
        {topic.videos.map((v, i) => {
          const open = canWatch(access, v);
          return (
            <Link
              key={v.id}
              href={open ? (user ? `/panel/videos/${v.id}` : `/login?next=/panel/videos/${v.id}`) : "#"}
              aria-disabled={!open}
              className={`card flex items-center gap-4 p-4 transition ${open ? "hover:border-cyan/40" : "cursor-not-allowed opacity-70"}`}
            >
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${open ? "bg-gradient-to-br from-cyan/25 to-violet/30 text-white" : "bg-white/5 text-white/40"}`}>
                {done.has(v.id) ? <CheckCircle2 className="size-6 text-lime" /> : open ? <PlayCircle className="size-6" /> : <Lock className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{faNum(i + 1)}. {v.title}</p>
                <p className="flex items-center gap-1 text-xs text-white/50"><Clock className="size-3" /> {fmtClock(v.durationSec)}</p>
              </div>
              {v.isFree && <span className="chip !border-lime/30 !bg-lime/10 !text-lime"><Gift className="size-3" /> رایگان</span>}
            </Link>
          );
        })}
        {topic.videos.length === 0 && <div className="card p-10 text-center text-white/50">ویدیوهای این مبحث به‌زودی منتشر می‌شوند.</div>}
      </div>
    </main>
  );
}
