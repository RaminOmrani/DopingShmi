import Link from "next/link";
import { Flame, PlayCircle, Target, TrendingUp, TrendingDown, Users, CalendarClock, Bell, ChevronLeft, FileCheck2, Clock, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { userStats } from "@/lib/stats";
import { examWhere, examState } from "@/lib/exams";
import { notificationsFor } from "@/lib/notify";
import { CLASS_STATUS_LABEL, groupLabel } from "@/lib/constants";
import { faNum, fmtDate, fmtDayShort, fmtDuration, fmtInt, fmtPct } from "@/lib/utils";
import { LevelBadge } from "@/components/panel/LevelBadge";
import { ExamTrend, DailyBars, Ring } from "@/components/charts/Charts";

export const metadata = { title: "داشبورد" };

const EVENT_LABEL: Record<string, { t: string; c: string }> = {
  FIXED: { t: "برگزار می‌شود", c: "text-lime border-lime/30 bg-lime/10" },
  CANCELLED: { t: "لغو شد", c: "text-rose border-rose/30 bg-rose/10" },
  RESCHEDULED: { t: "جابه‌جا شد", c: "text-amber border-amber/30 bg-amber/10" },
};

export default async function Dashboard() {
  const user = await requireUser();
  const [s, events, notes, cont, exams] = await Promise.all([
    userStats(user),
    user.classGroupId && user.classStatus === "APPROVED" ? db.classEvent.findMany({ where: { classGroupId: user.classGroupId }, orderBy: { createdAt: "desc" }, take: 4 }) : [],
    notificationsFor(user, 5),
    db.videoProgress.findMany({ where: { userId: user.id, completed: false }, orderBy: { updatedAt: "desc" }, take: 3, include: { video: { include: { topic: { select: { title: true } } } } } }),
    db.exam.findMany({ where: { ...examWhere(user), results: { none: { userId: user.id, status: "SUBMITTED" } } }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const openExams = exams.filter((e) => examState(e) === "OPEN");
  const trend = s.exams.map((e) => ({ name: e.title, you: e.percent, group: e.groupAvg }));
  const daily = s.days.map((d) => ({ label: fmtDayShort(d.day), video: d.videoMin, online: d.onlineMin }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* خوش‌آمد و سطح */}
      <section className="card glow-border relative overflow-hidden p-5 md:p-7">
        <div className="absolute -left-16 -top-16 size-64 rounded-full bg-violet/25 blur-3xl" />
        <div className="absolute -bottom-20 right-1/3 size-56 rounded-full bg-cyan/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <LevelBadge points={s.points} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/55">سلام {user.name.split(" ")[0]} 👋</p>
            <h1 className="mb-2 text-2xl font-black md:text-3xl">سطح {faNum(s.level.level)}: <span className="text-gradient">{s.level.name}</span></h1>
            <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-l from-cyan via-violet to-magenta" style={{ width: `${Math.round(s.level.progress * 100)}%` }} />
            </div>
            <p className="text-xs text-white/55">{fmtInt(s.points)} امتیاز · {fmtInt(Math.max(0, s.level.next - s.points))} امتیاز تا سطح بعد</p>
          </div>
          <div className="flex gap-3">
            <div className="glass rounded-2xl px-4 py-3 text-center">
              <Flame className="mx-auto mb-1 size-6 text-amber" />
              <p className="text-lg font-black">{faNum(s.streak)}</p>
              <p className="text-[10px] text-white/50">روز پیاپی</p>
            </div>
            <div className="glass rounded-2xl px-4 py-3 text-center">
              <Users className="mx-auto mb-1 size-6 text-cyan" />
              <p className="text-lg font-black">{s.rankInGroup ? faNum(s.rankInGroup) : "—"}<span className="text-xs text-white/40">/{faNum(s.groupSize)}</span></p>
              <p className="text-[10px] text-white/50">رتبه در {groupLabel(user.grade, user.major)}</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <span className={`chip ${user.classStatus === "APPROVED" ? "!border-lime/30 !text-lime" : user.classStatus === "PENDING" ? "!border-amber/30 !text-amber" : ""}`}>{CLASS_STATUS_LABEL[user.classStatus]}{user.classGroup && user.classStatus === "APPROVED" ? ` · ${user.classGroup.name}` : ""}</span>
          {user.classStatus === "PENDING" && <span className="chip">درخواست شما برای تأیید به استاد ارسال شده است</span>}
        </div>
      </section>

      {/* شاخص‌ها */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <Ring value={(s.avgPercent ?? 0) / 100} size={64}><span className="text-xs font-black">{s.avgPercent === null ? "—" : faNum(Math.round(s.avgPercent))}</span></Ring>
          <div>
            <p className="text-xs text-white/50">میانگین درصد</p>
            {s.trend !== null ? (
              <p className={`flex items-center gap-1 text-sm font-bold ${s.trend >= 0 ? "text-lime" : "text-rose"}`}>
                {s.trend >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {s.trend >= 0 ? "پیشرفت" : "پسرفت"} {fmtPct(Math.abs(s.trend))}
              </p>
            ) : <p className="text-sm font-bold">{faNum(s.examCount)} آزمون</p>}
          </div>
        </div>
        <div className="card p-4">
          <Target className="mb-2 size-6 text-violet" />
          <p className="text-2xl font-black">{fmtPct(s.bestPercent)}</p>
          <p className="text-xs text-white/50">بهترین درصد · {faNum(s.examCount)} آزمون</p>
        </div>
        <div className="card p-4">
          <PlayCircle className="mb-2 size-6 text-cyan" />
          <p className="text-2xl font-black">{faNum(s.completedVideos)}<span className="text-sm text-white/40"> / {faNum(s.startedVideos)}</span></p>
          <p className="text-xs text-white/50">ویدیوی کامل‌شده / شروع‌شده</p>
        </div>
        <div className="card p-4">
          <Clock className="mb-2 size-6 text-magenta" />
          <p className="text-lg font-black leading-8">{fmtDuration(s.totalVideoSec)}</p>
          <p className="text-xs text-white/50">مجموع زمان تماشا</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-5">
          <h2 className="mb-4 font-black">روند آزمون‌ها</h2>
          {trend.length ? <ExamTrend data={trend} /> : <Empty text="هنوز در آزمونی شرکت نکرده‌ای" href="/panel/exams" cta="آزمون‌ها" />}
          {trend.length > 0 && (
            <details className="mt-3 text-xs text-white/60">
              <summary className="cursor-pointer text-white/45">نمایش جدول</summary>
              <div className="table-wrap mt-2"><table className="table"><thead><tr><th>آزمون</th><th>درصد شما</th><th>میانگین گروه</th></tr></thead>
                <tbody>{s.exams.map((e) => <tr key={e.id}><td>{e.title}</td><td>{fmtPct(e.percent)}</td><td>{fmtPct(e.groupAvg)}</td></tr>)}</tbody></table></div>
            </details>
          )}
        </section>
        <section className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-black"><FileCheck2 className="size-5 text-cyan" /> آزمون‌های فعال</h2>
            {openExams.length ? openExams.map((e) => (
              <Link key={e.id} href={`/panel/exams/${e.id}`} className="mb-2 flex items-center justify-between rounded-2xl bg-white/[.04] px-4 py-3 text-sm transition hover:bg-white/[.08]">
                <span className="font-bold">{e.title}</span><ChevronLeft className="size-4 text-white/40" />
              </Link>
            )) : <p className="text-sm text-white/45">فعلاً آزمون جدیدی نداری ✨</p>}
          </div>
          {cont.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-black"><PlayCircle className="size-5 text-violet" /> ادامه تماشا</h2>
              {cont.map((p) => (
                <Link key={p.id} href={`/panel/videos/${p.videoId}`} className="mb-2 block rounded-2xl bg-white/[.04] px-4 py-3 transition hover:bg-white/[.08]">
                  <p className="truncate text-sm font-bold">{p.video.title}</p>
                  <p className="mb-2 text-[11px] text-white/45">{p.video.topic.title}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-l from-cyan to-violet" style={{ width: `${Math.min(100, Math.round((p.lastPosition / Math.max(1, p.video.durationSec)) * 100))}%` }} /></div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">فعالیت ۳۰ روز اخیر</h2>
          <span className="text-xs text-white/45">مجموع آنلاین این ماه: {fmtDuration(s.monthOnlineSec)}</span>
        </div>
        <p className="mb-2 text-xs text-white/50">دقیقه‌های تماشای ویدیو در هر روز</p>
        <DailyBars data={daily} dataKey="video" name="تماشای ویدیو" unit=" دقیقه" />
        <Heat days={s.days} />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {events.length > 0 && (
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-black"><CalendarClock className="size-5 text-lime" /> برنامه کلاس</h2>
            {events.map((e) => (
              <div key={e.id} className="mb-2 flex items-center justify-between rounded-2xl bg-white/[.04] px-4 py-3 text-sm">
                <div>
                  <p className="font-bold">{e.date}{e.time ? ` · ساعت ${e.time}` : ""}</p>
                  <p className="text-xs text-white/50">{e.location || e.note || ""}</p>
                </div>
                <span className={`chip ${EVENT_LABEL[e.kind]?.c}`}>{EVENT_LABEL[e.kind]?.t}</span>
              </div>
            ))}
          </section>
        )}
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-black"><Bell className="size-5 text-amber" /> اطلاعیه‌ها</h2>
          {notes.length ? notes.map((n) => (
            <div key={n.id} className="mb-2 rounded-2xl bg-white/[.04] px-4 py-3">
              <p className="text-sm font-bold">{n.title}</p>
              <p className="whitespace-pre-line text-xs leading-6 text-white/60">{n.body}</p>
              <p className="mt-1 text-[10px] text-white/35">{fmtDate(n.createdAt, true)}</p>
            </div>
          )) : <p className="text-sm text-white/45">اطلاعیه‌ای نداری.</p>}
        </section>
      </div>
    </div>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="grid h-60 place-items-center text-center">
      <div>
        <Sparkles className="mx-auto mb-2 size-8 text-white/25" />
        <p className="mb-3 text-sm text-white/50">{text}</p>
        <Link href={href} className="btn-ghost btn-sm">{cta}</Link>
      </div>
    </div>
  );
}

/** نقشه‌ی حرارتی حضور روزانه */
function Heat({ days }: { days: { day: string; points: number; onlineMin: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.onlineMin));
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs text-white/50">حضور روزانه (هر خانه یک روز؛ پررنگ‌تر یعنی فعال‌تر)</p>
      <div className="flex flex-wrap gap-1.5">
        {days.map((d) => {
          const v = d.onlineMin / max;
          return (
            <span key={d.day} title={`${fmtDayShort(d.day)}: ${faNum(d.onlineMin)} دقیقه · ${faNum(d.points)} امتیاز`}
              className="size-5 rounded-md border border-white/5 md:size-6"
              style={{ background: d.onlineMin ? `rgba(8,145,178,${0.2 + v * 0.8})` : "rgba(255,255,255,.04)" }} />
          );
        })}
      </div>
    </div>
  );
}
