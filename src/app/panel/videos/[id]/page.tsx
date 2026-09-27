import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccess, canWatch } from "@/lib/access";
import { VideoPlayer } from "@/components/panel/VideoPlayer";
import { BuyButton } from "@/components/BuyButton";
import { faNum, fmtClock, fmtToman } from "@/lib/utils";

export default async function Watch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const video = await db.video.findUnique({ where: { id }, include: { topic: { include: { videos: { where: { published: true }, orderBy: { order: "asc" } } } } } });
  if (!video || !video.published) notFound();
  const access = await getAccess(user);
  const open = canWatch(access, video);
  const done = new Set((await db.videoProgress.findMany({ where: { userId: user.id, completed: true, videoId: { in: video.topic.videos.map((v) => v.id) } }, select: { videoId: true } })).map((p) => p.videoId));
  const idx = video.topic.videos.findIndex((v) => v.id === id);
  const next = video.topic.videos[idx + 1];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/panel/videos/topic/${video.topicId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-cyan"><ArrowRight className="size-4" /> {video.topic.title}</Link>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          {open ? (
            <VideoPlayer videoId={video.id} />
          ) : (
            <div className="card grid aspect-video place-items-center p-6 text-center">
              <div>
                <Lock className="mx-auto mb-3 size-10 text-amber" />
                <p className="mb-4 text-white/70">برای دیدن این ویدیو، مبحث «{video.topic.title}» را تهیه کنید.</p>
                {video.topic.price > 0 && <BuyButton type="TOPIC" id={video.topicId} loggedIn label={`خرید مبحث · ${fmtToman(video.topic.price)}`} />}
              </div>
            </div>
          )}
          <h1 className="mt-5 text-xl font-black md:text-2xl">{video.title}</h1>
          {video.description && <p className="mt-2 whitespace-pre-line leading-8 text-white/60">{video.description}</p>}
          {next && canWatch(access, next) && (
            <Link href={`/panel/videos/${next.id}`} className="btn-ghost mt-5">ویدیوی بعدی: {next.title}</Link>
          )}
        </div>
        <aside className="card h-max p-3">
          <p className="px-2 pb-2 pt-1 text-sm font-black">جلسات این مبحث</p>
          <div className="grid gap-1">
            {video.topic.videos.map((v, i) => {
              const ok = canWatch(access, v);
              const cur = v.id === id;
              return (
                <Link key={v.id} href={ok ? `/panel/videos/${v.id}` : "#"} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${cur ? "bg-gradient-to-l from-cyan/15 to-violet/15" : "hover:bg-white/5"} ${ok ? "" : "opacity-50"}`}>
                  {done.has(v.id) ? <CheckCircle2 className="size-4 shrink-0 text-lime" /> : ok ? <PlayCircle className="size-4 shrink-0 text-cyan" /> : <Lock className="size-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{faNum(i + 1)}. {v.title}</span>
                  <span className="text-[10px] text-white/40">{fmtClock(v.durationSec)}</span>
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
