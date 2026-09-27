import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, XCircle, MinusCircle, Trophy, Users, BarChart3 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeExam, examState } from "@/lib/exams";
import { resultPercent } from "@/lib/stats";
import { ExamRunner, LaunchExternal } from "@/components/panel/ExamRunner";
import { Ring } from "@/components/charts/Charts";
import { faNum, fmtDate, fmtPct } from "@/lib/utils";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await canSeeExam(user, id))) notFound();
  const exam = await db.exam.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } } } });
  if (!exam) notFound();
  const r = await db.examResult.findUnique({ where: { examId_userId: { examId: id, userId: user.id } } });
  const st = examState(exam);
  const back = <Link href="/panel/exams" className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-cyan"><ArrowRight className="size-4" /> آزمون‌ها</Link>;

  if (r?.status === "SUBMITTED") {
    const all = await db.examResult.findMany({ where: { examId: id, status: "SUBMITTED" }, select: { percent: true, score: true, userId: true } });
    const values = all.map((x) => ({ u: x.userId, p: resultPercent(x, exam.maxScore) ?? 0 })).sort((a, b) => b.p - a.p);
    const my = resultPercent(r, exam.maxScore);
    const rank = r.rank ?? values.findIndex((v) => v.u === user.id) + 1;
    const avg = values.length ? values.reduce((s, v) => s + v.p, 0) / values.length : null;
    const answers = (r.answers ?? {}) as Record<string, number | null>;
    return (
      <div className="mx-auto max-w-4xl">
        {back}
        <div className="card glow-border relative mb-5 overflow-hidden p-6">
          <div className="absolute -left-10 -top-10 size-52 rounded-full bg-violet/25 blur-3xl" />
          <p className="text-sm text-white/55">کارنامه</p>
          <h1 className="mb-5 text-2xl font-black">{exam.title}</h1>
          <div className="flex flex-wrap items-center gap-6">
            <Ring value={Math.max(0, (my ?? 0) / 100)} size={130} stroke={11}>
              <div><p className="text-2xl font-black">{fmtPct(my)}</p><p className="text-[10px] text-white/50">درصد</p></div>
            </Ring>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {exam.kind === "INTERNAL" ? (
                <>
                  <Stat icon={<CheckCircle2 className="size-5 text-lime" />} v={faNum(r.correct)} l="درست" />
                  <Stat icon={<XCircle className="size-5 text-rose" />} v={faNum(r.wrong)} l="غلط" />
                  <Stat icon={<MinusCircle className="size-5 text-white/50" />} v={faNum(r.blank)} l="نزده" />
                </>
              ) : (
                <>
                  <Stat icon={<BarChart3 className="size-5 text-cyan" />} v={r.score !== null ? faNum(r.score) : "—"} l={`نمره از ${faNum(exam.maxScore)}`} />
                  <Stat icon={<BarChart3 className="size-5 text-violet" />} v={r.taraz ? faNum(r.taraz) : "—"} l="تراز" />
                </>
              )}
              <Stat icon={<Trophy className="size-5 text-amber" />} v={rank ? `${faNum(rank)} / ${faNum(values.length)}` : "—"} l="رتبه" />
              <Stat icon={<Users className="size-5 text-cyan" />} v={fmtPct(avg)} l="میانگین شرکت‌کنندگان" />
            </div>
          </div>
          <p className="mt-4 text-xs text-white/40">ثبت: {fmtDate(r.submittedAt, true)}</p>
        </div>

        {exam.kind === "INTERNAL" && exam.showAnswers && (
          <div className="space-y-3">
            <h2 className="font-black">پاسخ‌نامه تشریحی</h2>
            {exam.questions.map((q, i) => {
              const a = answers[q.id];
              const opts = q.options as string[];
              return (
                <div key={q.id} className="card p-5">
                  <p className="mb-3 leading-8"><span className="ml-2 inline-grid size-7 place-items-center rounded-lg bg-white/10 text-sm font-black">{faNum(i + 1)}</span>{q.text}</p>
                  {q.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.image} alt="" className="mb-3 max-h-72 rounded-xl bg-white p-2" />
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {opts.map((o, oi) => (
                      <div key={oi} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${oi === q.correct ? "border-lime/50 bg-lime/10" : oi === a ? "border-rose/50 bg-rose/10" : "border-white/5 bg-white/[.02] text-white/60"}`}>
                        <span className="text-xs font-black">{faNum(oi + 1)})</span> <span dir="auto">{o}</span>
                        {oi === q.correct && <CheckCircle2 className="mr-auto size-4 text-lime" />}
                        {oi === a && oi !== q.correct && <XCircle className="mr-auto size-4 text-rose" />}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <p className="mt-3 rounded-xl bg-cyan/5 p-3 text-sm leading-7 text-white/70">💡 {q.explanation}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (exam.kind === "EXTERNAL") {
    return (
      <div className="mx-auto max-w-3xl">
        {back}
        <div className="card glow-border p-7">
          <p className="chip mb-3">آزمون پلکان</p>
          <h1 className="mb-2 text-2xl font-black">{exam.title}</h1>
          {exam.description && <p className="mb-5 whitespace-pre-line leading-8 text-white/60">{exam.description}</p>}
          {exam.endAt && <p className="mb-5 text-sm text-white/55">مهلت: {fmtDate(exam.endAt, true)}</p>}
          {st === "CLOSED" ? <p className="text-white/50">مهلت این آزمون تمام شده است.</p> : st === "UPCOMING" ? <p className="text-white/60">شروع: {fmtDate(exam.startAt, true)}</p> : <LaunchExternal examId={exam.id} mode={exam.openMode} url={exam.externalUrl ?? ""} />}
          {r?.status === "LAUNCHED" && <p className="mt-5 rounded-2xl bg-amber/10 p-4 text-sm text-amber">شرکت شما ثبت شد. نتیجه پس از ورود توسط استاد، در کارنامه و نمودارهایت نمایش داده می‌شود.</p>}
        </div>
      </div>
    );
  }

  if (st !== "OPEN")
    return (
      <div className="mx-auto max-w-xl">{back}<div className="card p-8 text-center text-white/60">{st === "UPCOMING" ? `این آزمون از ${fmtDate(exam.startAt, true)} فعال می‌شود.` : "مهلت این آزمون تمام شده است."}</div></div>
    );

  return (
    <div>
      {back}
      <ExamRunner examId={exam.id} title={exam.title} count={exam.questions.length} durationMin={exam.durationMin} negative={exam.negative} resumable={r?.status === "IN_PROGRESS"} />
    </div>
  );
}

function Stat({ icon, v, l }: { icon: React.ReactNode; v: string; l: string }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <div className="mb-1 flex justify-center">{icon}</div>
      <p className="font-black">{v}</p>
      <p className="text-[10px] text-white/50">{l}</p>
    </div>
  );
}
