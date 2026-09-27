import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, PlayCircle, CheckCircle2, Gift, Clock, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccess, canWatch } from "@/lib/access";
import { BuyButton } from "@/components/BuyButton";
import { gradeLabel } from "@/lib/constants";
import { faNum, fmtClock, fmtDate, fmtToman } from "@/lib/utils";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const topic = await db.topic.findUnique({ where: { id }, include: { videos: { where: { published: true }, orderBy: { order: "asc" } }, bundles: { where: { active: true } } } });
  if (!topic || !topic.published) notFound();
  const access = await getAccess(user);
  const owned = access.all || access.topicIds.has(topic.id);
  const prog = await db.videoProgress.findMany({ where: { userId: user.id, videoId: { in: topic.videos.map((v) => v.id) } } });
  const pm = new Map(prog.map((p) => [p.videoId, p]));
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/panel/videos" className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-cyan"><ArrowRight className="size-4" /> مباحث</Link>
      <p className="text-sm font-bold text-cyan">شیمی {gradeLabel(topic.grade)}</p>
      <h1 className="mb-3 text-2xl font-black md:text-3xl">{topic.title}</h1>
      {topic.description && <p className="mb-5 leading-8 text-white/60">{topic.description}</p>}
      {!owned && (
        <div className="card glow-border mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-black">دسترسی کامل به این مبحث</p>
            <p className="text-sm text-white/55">{topic.price > 0 ? fmtToman(topic.price) : "از طریق بسته‌های جامع"}{access.expires.get(topic.id) ? ` · تا ${fmtDate(access.expires.get(topic.id)!)}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {topic.price > 0 && <BuyButton type="TOPIC" id={topic.id} loggedIn />}
            {topic.bundles.map((b) => <Link key={b.id} href={`/courses/bundle-${b.id}`} className="btn-ghost">{b.title} · {fmtToman(b.price)}</Link>)}
          </div>
        </div>
      )}
      <div className="grid gap-3">
        {topic.videos.map((v, i) => {
          const open = canWatch(access, v);
          const p = pm.get(v.id);
          const pct = p && v.durationSec ? Math.min(100, Math.round((p.lastPosition / v.durationSec) * 100)) : 0;
          const Inner = (
            <>
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${open ? "bg-gradient-to-br from-cyan/25 to-violet/30" : "bg-white/5 text-white/40"}`}>
                {p?.completed ? <CheckCircle2 className="size-6 text-lime" /> : open ? <PlayCircle className="size-6" /> : <Lock className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{faNum(i + 1)}. {v.title}</p>
                <p className="flex items-center gap-1 text-xs text-white/50"><Clock className="size-3" /> {fmtClock(v.durationSec)}{pct > 0 && !p?.completed ? ` · ${faNum(pct)}٪ دیده شده` : ""}</p>
                {pct > 0 && !p?.completed && <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan" style={{ width: `${pct}%` }} /></div>}
              </div>
              {v.isFree && !owned && <span className="chip !border-lime/30 !text-lime"><Gift className="size-3" /> رایگان</span>}
            </>
          );
          return open ? (
            <Link key={v.id} href={`/panel/videos/${v.id}`} className="card flex items-center gap-4 p-4 transition hover:border-cyan/40">{Inner}</Link>
          ) : (
            <div key={v.id} className="card flex items-center gap-4 p-4 opacity-60">{Inner}</div>
          );
        })}
        {topic.videos.length === 0 && <div className="card p-10 text-center text-white/50">ویدیوهای این مبحث به‌زودی منتشر می‌شوند.</div>}
      </div>
    </div>
  );
}
