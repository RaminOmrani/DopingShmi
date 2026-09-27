import Link from "next/link";
import { Lock, PlayCircle, CheckCircle2, Gift } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/access";
import { GRADES, gradeLabel } from "@/lib/constants";
import { faNum, fmtToman } from "@/lib/utils";

export const metadata = { title: "ویدیوها" };

export default async function Videos({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const g = sp.g || (user.grade === "GRAD" ? "G12" : user.grade) || "G12";
  const [topics, access, progress] = await Promise.all([
    db.topic.findMany({ where: { published: true, grade: { in: [g, "ALL"] } }, orderBy: { order: "asc" }, include: { videos: { where: { published: true }, select: { id: true, isFree: true } } } }),
    getAccess(user),
    db.videoProgress.findMany({ where: { userId: user.id, completed: true }, select: { videoId: true } }),
  ]);
  const done = new Set(progress.map((p) => p.videoId));
  const visible = topics.filter((t) => !user.major || t.majors.length === 0 || t.majors.includes(user.major));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-black">ویدیوهای آموزشی</h1>
      <p className="mb-5 text-sm text-white/55">مبحث‌به‌مبحث؛ هر ویدیویی که کامل ببینی امتیاز می‌گیری.</p>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {GRADES.filter((x) => x.value !== "GRAD").map((x) => (
          <Link key={x.value} href={`?g=${x.value}`} className={`btn btn-sm shrink-0 ${g === x.value ? "btn-primary" : "btn-ghost"}`}>شیمی {x.label}</Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => {
          const open = access.all || access.topicIds.has(t.id);
          const c = t.videos.filter((v) => done.has(v.id)).length;
          const pct = t.videos.length ? Math.round((c / t.videos.length) * 100) : 0;
          return (
            <Link key={t.id} href={`/panel/videos/topic/${t.id}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:border-cyan/30">
              <div className="relative h-32 overflow-hidden bg-gradient-to-br from-violet/30 via-deep to-cyan/15">
                {t.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.cover} alt="" className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105" />
                )}
                <span className="absolute right-3 top-3">{open ? <span className="chip !border-lime/30 !bg-black/50 !text-lime"><CheckCircle2 className="size-3" /> باز</span> : <span className="chip !bg-black/50"><Lock className="size-3" /> {t.price ? fmtToman(t.price) : "قفل"}</span>}</span>
                {!open && t.videos.some((v) => v.isFree) && <span className="chip absolute left-3 top-3 !border-lime/30 !bg-black/50 !text-lime"><Gift className="size-3" /> رایگان دارد</span>}
                <PlayCircle className="absolute inset-0 m-auto size-12 text-white/80" strokeWidth={1.2} />
              </div>
              <div className="p-4">
                <p className="mb-1 font-black">{t.title}</p>
                <p className="mb-3 text-xs text-white/50">{faNum(t.videos.length)} ویدیو · {faNum(c)} دیده‌شده</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-l from-cyan to-violet" style={{ width: `${pct}%` }} /></div>
              </div>
            </Link>
          );
        })}
        {visible.length === 0 && <div className="card col-span-full p-12 text-center text-white/50">برای شیمی {gradeLabel(g)} هنوز ویدیویی منتشر نشده است.</div>}
      </div>
    </div>
  );
}
