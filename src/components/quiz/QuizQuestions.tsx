import { cn, faNum } from "@/lib/utils";
import type { QuizContent } from "@/content/quizzes";
import { QuizText } from "./QuizText";

/**
 * فهرست سؤال‌های آزمون، کاملاً در سرور رندر می‌شود (بدون hook): همه‌ی سؤال‌ها، گزینه‌ها (radio) و پاسخ تشریحی
 * در <details>، تا آزمون بدون جاوااسکریپت هم قابل استفاده باشد. تصحیح و بازخورد را QuizRunner (کلاینت) اضافه می‌کند:
 * روی form ویژگی data-graded و روی هر fieldset ویژگی data-result (correct/wrong/blank) می‌گذارد و رنگ‌ها با CSS عوض می‌شوند.
 */

const NUM = ["۱", "۲", "۳", "۴"];

export function QuizQuestions({ quiz }: { quiz: QuizContent }) {
  return (
    <ol className="space-y-5">
      {quiz.questions.map((q, i) => (
        <li key={q.id}>
          <fieldset
            id={`q${i + 1}`}
            data-q={i}
            className="group/q card min-w-0 scroll-mt-28 p-5 transition-colors data-[result=blank]:border-amber/40 data-[result=correct]:border-teal/50 data-[result=wrong]:border-rose/50 print:break-inside-avoid print:p-3"
          >
            <legend className="float-start mb-3 w-full text-[15px] font-bold leading-8">
              <span className="ml-2 inline-grid size-7 place-items-center rounded-lg bg-white/10 align-middle text-sm font-black">{faNum(i + 1)}</span>
              <QuizText text={q.text} />
            </legend>
            <div className="clear-both">
              <p className="mb-3 flex flex-wrap gap-1.5 text-[11px] text-white/45">
                <span>{q.subtopic}</span>
                <span aria-hidden>·</span>
                <span>{q.level}</span>
              </p>
              {q.given && (
                <p className="mb-3 rounded-xl bg-white/[.04] px-3 py-2 text-xs leading-7 text-white/70">
                  <span className="font-bold text-white/80">داده‌ها: </span>
                  <QuizText text={q.given} />
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, j) => {
                  const ok = j === q.correct;
                  return (
                    <label
                      key={j}
                      data-correct={ok ? "" : undefined}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm leading-7 transition hover:bg-white/[.07] has-checked:border-cyan/60 has-checked:bg-cyan/10 group-data-graded/quiz:cursor-default",
                        ok
                          ? "group-data-graded/quiz:border-teal/60 group-data-graded/quiz:bg-teal/10"
                          : "group-data-graded/quiz:has-checked:border-rose/60 group-data-graded/quiz:has-checked:bg-rose/10",
                      )}
                    >
                      <input type="radio" name={q.id} value={j} className="mt-1.5 size-4 shrink-0 accent-cyan" />
                      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-white/10 text-xs font-black text-white/70">{NUM[j]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">گزینه‌ی {NUM[j]}: </span>
                        <QuizText text={o} />
                        {ok && <span className="chip mr-2 hidden align-middle !border-teal/40 !text-teal group-data-graded/quiz:inline-flex">پاسخ درست</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 hidden text-sm font-bold group-data-[result]/q:block">
                <span className="hidden text-teal group-data-[result=correct]/q:inline">پاسخ شما درست است.</span>
                <span className="hidden text-rose group-data-[result=wrong]/q:inline">پاسخ شما نادرست است.</span>
                <span className="hidden text-amber group-data-[result=blank]/q:inline">به این سؤال پاسخ نداده‌اید.</span>
              </p>
              <details className="mt-3 rounded-2xl border border-white/5 bg-white/[.02] px-4 py-3 print:hidden">
                <summary className="cursor-pointer text-sm font-bold text-cyan">پاسخ و توضیح</summary>
                <p className="mt-2 text-sm font-bold text-white/85">پاسخ درست: گزینه‌ی {NUM[q.correct]}</p>
                <p className="mt-1 text-sm leading-8 text-white/75">
                  <QuizText text={q.explanation} />
                </p>
              </details>
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}

/** کلید پاسخ‌ها فقط برای چاپ (پاسخ تشریحی‌ها در چاپ پنهان‌اند) */
export function QuizAnswerKey({ quiz }: { quiz: QuizContent }) {
  return (
    <section className="mt-8 hidden break-inside-avoid print:block">
      <h2 className="mb-2 text-base font-black">کلید پاسخ‌ها</h2>
      <p className="text-sm leading-8">
        {quiz.questions.map((q, i) => (
          <span key={q.id} className="ml-4 inline-block">
            سؤال {faNum(i + 1)}: گزینه‌ی {NUM[q.correct]}
          </span>
        ))}
      </p>
    </section>
  );
}
