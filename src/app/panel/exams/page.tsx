import Link from "next/link";
import { FileCheck2, ExternalLink, CheckCircle2, Clock, CalendarClock, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { examWhere, examState } from "@/lib/exams";
import { resultPercent } from "@/lib/stats";
import { faNum, fmtDate, fmtPct } from "@/lib/utils";

export const metadata = { title: "آزمون‌ها" };

export default async function Exams() {
  const user = await requireUser();
  const exams = await db.exam.findMany({
    where: examWhere(user),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true } }, results: { where: { userId: user.id } } },
  });
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-black">آزمون‌ها</h1>
      <p className="mb-6 text-sm text-white/55">آزمون‌های سایت و آزمون‌های پلکان؛ همه‌ی نتایج در کارنامه و نمودار پیشرفتت ثبت می‌شود.</p>
      {user.classStatus !== "APPROVED" && (
        <div className="card mb-5 flex items-center gap-3 p-4 text-sm text-white/65"><Lock className="size-5 text-amber" /> آزمون‌های کلاسی پس از تأیید شاگرد بودن شما نمایش داده می‌شوند.</div>
      )}
      <div className="grid gap-3">
        {exams.map((e) => {
          const r = e.results[0];
          const st = examState(e);
          const submitted = r?.status === "SUBMITTED";
          const pct = submitted ? resultPercent(r, e.maxScore) : null;
          return (
            <Link key={e.id} href={`/panel/exams/${e.id}`} className="card flex flex-wrap items-center gap-4 p-4 transition hover:border-cyan/30">
              <span className={`grid size-12 place-items-center rounded-2xl ${submitted ? "bg-lime/15 text-lime" : "bg-gradient-to-br from-cyan/20 to-violet/25 text-cyan"}`}>
                {submitted ? <CheckCircle2 className="size-6" /> : e.kind === "EXTERNAL" ? <ExternalLink className="size-6" /> : <FileCheck2 className="size-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{e.title}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-white/50">
                  {e.kind === "EXTERNAL" ? <span>آزمون پلکان</span> : <span>{faNum(e._count.questions)} سؤال · {faNum(e.durationMin)} دقیقه</span>}
                  {e.endAt && <span className="flex items-center gap-1"><CalendarClock className="size-3" /> تا {fmtDate(e.endAt, true)}</span>}
                </p>
              </div>
              {submitted ? (
                <span className="text-lg font-black text-gradient">{pct !== null ? fmtPct(pct) : "ثبت شد"}</span>
              ) : st === "UPCOMING" ? (
                <span className="chip"><Clock className="size-3" /> از {fmtDate(e.startAt, true)}</span>
              ) : st === "CLOSED" ? (
                <span className="chip !text-white/40">پایان یافته</span>
              ) : r?.status === "LAUNCHED" ? (
                <span className="chip !text-amber">در انتظار ثبت نتیجه</span>
              ) : (
                <span className="chip !border-cyan/30 !text-cyan">شرکت کن</span>
              )}
            </Link>
          );
        })}
        {exams.length === 0 && <div className="card p-12 text-center text-white/50">فعلاً آزمونی برای شما تعریف نشده است.</div>}
      </div>
    </div>
  );
}
