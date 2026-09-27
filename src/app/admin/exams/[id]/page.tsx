import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { PageHead, Field } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { ExamForm } from "@/components/admin/ExamForm";
import { ImportResults } from "@/components/admin/ImportResults";
import { DailyBars } from "@/components/charts/Charts";
import { saveQuestion, deleteQuestion, deleteExam, saveManualScores, sendResultsSms } from "../actions";
import { resultPercent } from "@/lib/stats";
import { toJalaliInput } from "@/lib/jalali";
import { faNum, fmtDate, fmtPct } from "@/lib/utils";

type Q = { id: string; order: number; text: string; image: string | null; options: unknown; correct: number; explanation: string | null };

export default async function ExamAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const tab = (await searchParams).tab ?? "results";
  const exam = await db.exam.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } } } });
  if (!exam) notFound();
  const [groups, results, eligible] = await Promise.all([
    db.classGroup.findMany({ orderBy: { order: "asc" } }),
    db.examResult.findMany({ where: { examId: id }, include: { user: { select: { id: true, name: true, phone: true } } } }),
    db.user.findMany({
      where: { role: "USER", ...(exam.grade ? { grade: exam.grade } : {}), ...(exam.major ? { major: exam.major } : {}), ...(exam.audience === "GROUP" ? { classGroupId: exam.classGroupId, classStatus: "APPROVED" } : exam.audience === "STUDENTS" ? { classStatus: "APPROVED" } : {}) },
      orderBy: { name: "asc" }, take: 400, select: { id: true, name: true, phone: true },
    }),
  ]);
  const submitted = results.filter((r) => r.status === "SUBMITTED").map((r) => ({ ...r, pct: resultPercent(r, exam.maxScore) })).sort((a, b) => (b.pct ?? -999) - (a.pct ?? -999));
  const launched = results.filter((r) => r.status !== "SUBMITTED");
  const byUser = new Map(results.map((r) => [r.userId, r]));
  const pcts = submitted.map((s) => s.pct).filter((x): x is number => x !== null);
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  // توزیع درصدها
  const bins = [-40, 0, 20, 40, 60, 80].map((lo) => ({ label: lo < 0 ? "منفی" : `${faNum(lo)}–${faNum(lo + 20)}٪`, v: pcts.filter((p) => (lo < 0 ? p < 0 : p >= lo && (lo === 80 ? p <= 100 : p < lo + 20))).length }));
  const tabs = [["results", `نتایج (${faNum(submitted.length)})`], ...(exam.kind === "INTERNAL" ? [["questions", `سؤال‌ها (${faNum(exam.questions.length)})`]] : []), ["import", "ورود نتایج"], ["settings", "تنظیمات"]];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/exams" className="mb-3 inline-flex items-center gap-1 text-sm text-white/50 hover:text-cyan"><ArrowRight className="size-4" /> آزمون‌ها</Link>
      <PageHead title={exam.title} desc={`${exam.kind === "EXTERNAL" ? "آزمون پلکان" : "آزمون داخلی"} · ${exam.published ? "منتشر شده" : "پیش‌نویس"} · میانگین ${fmtPct(avg)}`} />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {tabs.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={`btn btn-sm shrink-0 ${tab === k ? "btn-primary" : "btn-ghost"}`}>{l}</Link>)}
      </div>

      {tab === "results" && (
        <div className="space-y-5">
          {pcts.length > 0 && <section className="card p-5"><h2 className="mb-3 font-black">توزیع درصدها (تعداد نفر در هر بازه)</h2><DailyBars data={bins} dataKey="v" name="تعداد" unit=" نفر" height={200} interval={0} /></section>}
          <section className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-black">رتبه‌بندی شرکت‌کنندگان</h2>
              <Form action={sendResultsSms} confirm="پیامک نتیجه برای همه‌ی شرکت‌کنندگان ارسال شود؟" className="flex items-center gap-2">
                <input type="hidden" name="examId" value={exam.id} />
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="parents" className="size-4" /> به والدین هم</label>
                <Submit className="btn-primary btn-sm">ارسال پیامک نتایج</Submit>
              </Form>
            </div>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>رتبه</th><th>نام</th><th>موبایل</th><th>درصد</th>{exam.kind === "INTERNAL" ? <><th>درست</th><th>غلط</th><th>نزده</th></> : <><th>نمره</th><th>تراز</th></>}<th>منبع</th><th>زمان</th></tr></thead>
              <tbody>{submitted.map((r, i) => (
                <tr key={r.id}><td>{faNum(r.rank ?? i + 1)}</td><td><Link href={`/admin/users/${r.userId}`} className="font-bold hover:text-cyan">{r.user.name}</Link></td><td dir="ltr" className="text-right text-xs">{faNum(r.user.phone)}</td><td className="font-black">{fmtPct(r.pct)}</td>
                  {exam.kind === "INTERNAL" ? <><td>{faNum(r.correct)}</td><td>{faNum(r.wrong)}</td><td>{faNum(r.blank)}</td></> : <><td>{r.score !== null ? faNum(r.score) : "—"}</td><td>{r.taraz ? faNum(r.taraz) : "—"}</td></>}
                  <td className="text-xs">{{ INTERNAL: "سایت", IMPORT: "اکسل", MANUAL: "دستی" }[r.source] ?? r.source}</td><td className="text-xs text-white/50">{fmtDate(r.submittedAt, true)}</td></tr>
              ))}</tbody>
            </table></div>
            {launched.length > 0 && <p className="mt-3 text-xs text-white/50">{faNum(launched.length)} نفر وارد آزمون شده‌اند ولی نتیجه‌شان هنوز ثبت نشده: {launched.map((l) => l.user.name).join("، ")}</p>}
          </section>
        </div>
      )}

      {tab === "questions" && exam.kind === "INTERNAL" && (
        <div className="space-y-3">
          {exam.questions.map((q, i) => (
            <details key={q.id} className="card p-4">
              <summary className="cursor-pointer text-sm"><b>{faNum(i + 1)}.</b> {q.text.slice(0, 120) || "(سؤال تصویری)"} <span className="text-lime">— گزینه {faNum(q.correct + 1)}</span></summary>
              <div className="mt-4"><QuestionForm examId={exam.id} q={q} /></div>
              <Form action={deleteQuestion} confirm="سؤال حذف شود؟" className="mt-2"><input type="hidden" name="id" value={q.id} /><input type="hidden" name="examId" value={exam.id} /><Submit className="btn-danger btn-sm">حذف</Submit></Form>
            </details>
          ))}
          <section className="card glow-border p-5"><h2 className="mb-4 font-black">سؤال جدید</h2><QuestionForm examId={exam.id} nextOrder={exam.questions.length + 1} /></section>
        </div>
      )}

      {tab === "import" && (
        <div className="space-y-5">
          <section className="card p-5"><h2 className="mb-4 font-black">ورود نتایج از فایل اکسل پلکان</h2><ImportResults examId={exam.id} maxScore={exam.maxScore} /></section>
          <section className="card p-5">
            <h2 className="mb-1 font-black">ثبت دستی نمره</h2>
            <p className="mb-4 text-xs text-white/50">{exam.kind === "EXTERNAL" ? `نمره از ${faNum(exam.maxScore)}` : "درصد"} را جلوی نام هر دانش‌آموز بنویسید؛ خانه‌های خالی تغییری نمی‌کنند.</p>
            <Form action={saveManualScores}>
              <input type="hidden" name="examId" value={exam.id} />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {eligible.map((u) => {
                  const r = byUser.get(u.id);
                  const cur = r?.status === "SUBMITTED" ? (r.score ?? r.percent) : null;
                  return (
                    <label key={u.id} className="flex items-center gap-2 rounded-xl bg-white/[.03] px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{u.name || u.phone}</span>
                      <input name={`score_${u.id}`} defaultValue={cur ?? ""} className="input !w-20 !py-1.5 text-center" inputMode="decimal" />
                    </label>
                  );
                })}
              </div>
              {eligible.length === 0 && <p className="text-sm text-white/45">دانش‌آموزی در مخاطبان این آزمون نیست.</p>}
              <Submit className="btn-primary mt-4">ذخیره نمره‌ها</Submit>
            </Form>
          </section>
        </div>
      )}

      {tab === "settings" && (
        <section className="card p-5">
          <ExamForm groups={groups.map((g) => ({ id: g.id, name: g.name }))} init={{ id: exam.id, title: exam.title, description: exam.description ?? "", kind: exam.kind, externalUrl: exam.externalUrl ?? "", openMode: exam.openMode, grade: exam.grade ?? "", major: exam.major ?? "", audience: exam.audience, classGroupId: exam.classGroupId ?? "", durationMin: exam.durationMin, startAt: toJalaliInput(exam.startAt), endAt: toJalaliInput(exam.endAt), negative: exam.negative, showAnswers: exam.showAnswers, maxScore: exam.maxScore, published: exam.published }} />
          <Form action={deleteExam} confirm="آزمون و همه‌ی نتایجش حذف شود؟" className="mt-4"><input type="hidden" name="id" value={exam.id} /><Submit className="btn-danger btn-sm">حذف آزمون</Submit></Form>
        </section>
      )}
    </div>
  );
}

function QuestionForm({ examId, q, nextOrder }: { examId: string; q?: Q; nextOrder?: number }) {
  const opts = (q?.options as string[]) ?? ["", "", "", ""];
  return (
    <Form action={saveQuestion} reset={!q} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={q?.id ?? ""} />
      <input type="hidden" name="examId" value={examId} />
      <Field label="صورت سؤال" className="sm:col-span-2"><textarea name="text" defaultValue={q?.text} rows={3} className="input" /></Field>
      {[0, 1, 2, 3].map((i) => (
        <label key={i} className="flex items-center gap-2">
          <input type="radio" name="correct" value={i} defaultChecked={(q?.correct ?? 0) === i} className="size-5 accent-lime-400" title="گزینه صحیح" />
          <input name={`o${i}`} defaultValue={opts[i]} className="input" placeholder={`گزینه ${i + 1}`} required />
        </label>
      ))}
      <Field label="تصویر سؤال (اختیاری)"><input type="file" name="image" accept="image/*" className="input !py-2 text-xs" /></Field>
      <Field label="ترتیب"><input name="order" defaultValue={q?.order ?? nextOrder ?? 0} className="input" inputMode="numeric" /></Field>
      {q?.image && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="removeImage" /> حذف تصویر فعلی</label>}
      <Field label="پاسخ تشریحی" className="sm:col-span-2"><textarea name="explanation" defaultValue={q?.explanation ?? ""} rows={2} className="input" /></Field>
      <p className="text-xs text-white/45 sm:col-span-2">دایره‌ی کنار گزینه‌ی صحیح را انتخاب کنید.</p>
      <Submit className="btn-primary sm:col-span-2">{q ? "ذخیره سؤال" : "افزودن سؤال"}</Submit>
    </Form>
  );
}
