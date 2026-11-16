"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleMinus, ClipboardCheck, RotateCcw, Timer, TimerOff, XCircle } from "lucide-react";
import { cn, faNum, fmtClock } from "@/lib/utils";
import { fmtPercent, loadScore, resultOf, saveScore, scoreQuiz, type QuizScore, type SavedScore } from "./score";

/**
 * جزیره‌ی کلاینتی آزمون آنلاین: دور فهرست سؤال‌های سروری (children) یک form می‌کشد و این‌ها را اضافه می‌کند:
 * شمارش پاسخ‌ها، زمان‌سنج اختیاری (یک دقیقه برای هر سؤال)، تصحیح با و بدون نمره‌ی منفی، بازخورد هر سؤال،
 * تلاش دوباره و ذخیره‌ی آخرین نتیجه در localStorage (داخل try/catch؛ چیزی به سرور فرستاده نمی‌شود).
 * منبع پاسخ‌ها خود DOM است (radioهای سروری)، پس انتخاب‌های پیش از hydrate شدن هم شمرده می‌شوند.
 */

type Props = {
  /** کلید localStorage، مثل quizStorageKey("dahom-fasl-1") */
  storageKey: string;
  /** شماره‌ی گزینه‌ی درست هر سؤال (از صفر)، به ترتیب fieldsetها */
  answerKey: number[];
  children: ReactNode;
};

const fieldsetsOf = (form: HTMLFormElement | null) => Array.from(form?.querySelectorAll<HTMLFieldSetElement>("fieldset[data-q]") ?? []);
const picksOf = (form: HTMLFormElement | null) =>
  fieldsetsOf(form).map((fs) => {
    const el = fs.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    return el ? Number(el.value) : null;
  });

export function QuizRunner({ storageKey, answerKey, children }: Props) {
  const total = answerKey.length;
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const gradedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [score, setScore] = useState<QuizScore | null>(null);
  /** آخرین نتیجه‌ی ذخیره‌شده (نوار بالا) و نتیجه‌ی تلاش قبل از این تصحیح (کادر نتیجه) */
  const [last, setLast] = useState<SavedScore | null>(null);
  const [prev, setPrev] = useState<SavedScore | null>(null);
  const [negative, setNegative] = useState(true);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [left, setLeft] = useState(total * 60);
  const [timeUp, setTimeUp] = useState(false);
  const [announce, setAnnounce] = useState("");

  const recount = useCallback(() => setAnswered(picksOf(formRef.current).filter((p) => p !== null).length), []);

  // پس از hydrate: فعال شدن دکمه‌ها، شمارش انتخاب‌های قبلی و خواندن آخرین نتیجه
  useEffect(() => {
    setReady(true);
    recount();
    setLast(loadScore(storageKey));
  }, [recount, storageKey]);

  const grade = useCallback(
    (auto: boolean) => {
      const form = formRef.current;
      if (!form || gradedRef.current) return;
      gradedRef.current = true;
      const picks = picksOf(form);
      const s = scoreQuiz(answerKey, picks);
      fieldsetsOf(form).forEach((fs, i) => {
        const r = resultOf(answerKey[i], picks[i]);
        fs.dataset.result = r;
        // پاسخ تشریحی سؤال‌های نادرست و بی‌پاسخ خودکار باز می‌شود
        const d = fs.querySelector("details");
        if (d) d.open = r !== "correct";
      });
      setPrev(loadScore(storageKey));
      const at = Date.now();
      if (saveScore(storageKey, s, undefined, at)) setLast({ ...s, at });
      setScore(s);
      setDeadline(null);
      setTimeUp(auto);
      setAnnounce(
        `${auto ? "زمان تمام شد. " : ""}نتیجه: ${faNum(s.correct)} درست، ${faNum(s.wrong)} نادرست، ${faNum(s.blank)} بی‌پاسخ؛ درصد با نمره‌ی منفی ${fmtPercent(s.percentNeg)} و بدون نمره‌ی منفی ${fmtPercent(s.percent)}.`,
      );
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        resultRef.current?.focus({ preventScroll: true });
      });
    },
    [answerKey, storageKey],
  );

  // زمان‌سنج: با پایان زمان، پاسخ‌نامه خودکار تصحیح می‌شود
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const l = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) grade(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, grade]);

  const startTimer = () => {
    setLeft(total * 60);
    setTimeUp(false);
    setDeadline(Date.now() + total * 60_000);
  };

  const retry = () => {
    const form = formRef.current;
    if (!form) return;
    form.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked').forEach((el) => (el.checked = false));
    fieldsetsOf(form).forEach((fs) => {
      delete fs.dataset.result;
      const d = fs.querySelector("details");
      if (d) d.open = false;
    });
    gradedRef.current = false;
    setScore(null);
    setAnswered(0);
    setDeadline(null);
    setTimeUp(false);
    setLeft(total * 60);
    setAnnounce("آزمون از نو شروع شد؛ همه‌ی پاسخ‌ها پاک شد.");
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    topRef.current?.focus({ preventScroll: true });
  };

  const running = deadline !== null;
  const main = score ? (negative ? score.percentNeg : score.percent) : 0;

  return (
    <div>
      {/* تنظیمات پیش از شروع */}
      <div ref={topRef} tabIndex={-1} className="card mb-5 scroll-mt-28 p-5 outline-none print:hidden">
        <p className="mb-3 font-black">پیش از شروع</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={negative} disabled={!ready} onChange={(e) => setNegative(e.target.checked)} className="size-4 accent-cyan" />
            نمره‌ی منفی (هر پاسخ نادرست، منهای یک‌سوم)
          </label>
          {running ? (
            <button type="button" onClick={() => setDeadline(null)} className="btn-ghost btn-sm">
              <TimerOff aria-hidden className="size-4" /> خاموش کردن زمان‌سنج
            </button>
          ) : (
            <button type="button" onClick={startTimer} disabled={!ready || !!score} className="btn-ghost btn-sm">
              <Timer aria-hidden className="size-4" /> شروع زمان‌سنج ({faNum(total)} دقیقه)
            </button>
          )}
        </div>
        <p className="mt-3 min-h-6 text-xs leading-6 text-white/50">
          {last
            ? `آخرین نتیجه‌ی شما در این مرورگر: ${fmtPercent(last.percentNeg)} با نمره‌ی منفی (${fmtPercent(last.percent)} بدون نمره‌ی منفی).`
            : "نتیجه فقط در همین مرورگر ذخیره می‌شود و برای هیچ‌کس فرستاده نمی‌شود."}
        </p>
        <noscript>
          <p className="mt-2 text-xs leading-6 text-amber">
            جاوااسکریپت مرورگر شما خاموش است: سؤال‌ها را حل کنید و پاسخ هر سؤال را با «پاسخ و توضیح» ببینید؛ تصحیح خودکار و زمان‌سنج کار نمی‌کند.
          </p>
        </noscript>
      </div>

      <form
        ref={formRef}
        className="group/quiz"
        data-graded={score ? "" : undefined}
        onChange={recount}
        onSubmit={(e) => {
          e.preventDefault();
          grade(false);
        }}
        autoComplete="off"
        noValidate
      >
        <fieldset disabled={!!score} className="m-0 min-w-0 border-0 p-0">
          {children}
        </fieldset>

        {/* نتیجه */}
        <div ref={resultRef} tabIndex={-1} className="scroll-mt-28 outline-none">
          {score && (
            <section className="card glow-border mt-6 p-6 print:hidden" aria-labelledby="quiz-result-title">
              <h2 id="quiz-result-title" className="mb-1 text-xl font-black">
                نتیجه‌ی آزمون
              </h2>
              {timeUp && <p className="mb-2 text-sm text-amber">زمان آزمون تمام شد و پاسخ‌نامه خودکار تصحیح شد.</p>}
              <p className="my-3 text-5xl font-black text-gradient">{fmtPercent(main)}</p>
              <p className="mb-5 text-sm leading-7 text-white/65">
                با نمره‌ی منفی: <b className="text-white/85">{fmtPercent(score.percentNeg)}</b> · بدون نمره‌ی منفی:{" "}
                <b className="text-white/85">{fmtPercent(score.percent)}</b>
              </p>
              <dl className="mb-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-teal/10 p-3">
                  <dt className="flex items-center justify-center gap-1 text-xs text-white/60">
                    <CheckCircle2 aria-hidden className="size-3.5 text-teal" /> درست
                  </dt>
                  <dd className="text-2xl font-black text-teal">{faNum(score.correct)}</dd>
                </div>
                <div className="rounded-2xl bg-rose/10 p-3">
                  <dt className="flex items-center justify-center gap-1 text-xs text-white/60">
                    <XCircle aria-hidden className="size-3.5 text-rose" /> نادرست
                  </dt>
                  <dd className="text-2xl font-black text-rose">{faNum(score.wrong)}</dd>
                </div>
                <div className="rounded-2xl bg-amber/10 p-3">
                  <dt className="flex items-center justify-center gap-1 text-xs text-white/60">
                    <CircleMinus aria-hidden className="size-3.5 text-amber" /> بی‌پاسخ
                  </dt>
                  <dd className="text-2xl font-black text-amber">{faNum(score.blank)}</dd>
                </div>
              </dl>
              <p className="text-xs leading-7 text-white/55">
                درصد با نمره‌ی منفی = (۳ × درست − نادرست) ÷ (۳ × کل سؤال‌ها)؛ یعنی هر پاسخ نادرست یک‌سوم نمره‌ی یک پاسخ درست را کم می‌کند و سؤال بی‌پاسخ نمره‌ی منفی ندارد.
                {score.wrong + score.blank > 0 && " پاسخ تشریحی سؤال‌های نادرست و بی‌پاسخ را باز کرده‌ایم."}
              </p>
              {prev && (
                <p className="mt-2 text-xs leading-7 text-white/55">
                  نتیجه‌ی قبلی شما در این مرورگر: {fmtPercent(prev.percentNeg)} با نمره‌ی منفی.
                </p>
              )}
              <button type="button" onClick={retry} className="btn-primary mt-5">
                <RotateCcw aria-hidden className="size-4" /> دوباره از نو
              </button>
            </section>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>

        {/* نوار پایین: پیشرفت، زمان و تصحیح */}
        <div className="glass sticky bottom-3 z-30 mt-6 flex items-center gap-3 rounded-2xl px-4 py-3 print:hidden">
          {running && (
            <span role="timer" aria-label="زمان باقی‌مانده" className={cn("flex items-center gap-1.5 font-black tabular-nums", left <= 60 ? "animate-pulse text-rose" : "text-white")}>
              <Timer aria-hidden className="size-4" /> {fmtClock(left)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs text-white/60">
              {faNum(answered)} از {faNum(total)} سؤال پاسخ داده شده
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-l from-cyan to-violet transition-all" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
            </div>
          </div>
          {score ? (
            <button type="button" onClick={retry} className="btn-ghost btn-sm shrink-0">
              <RotateCcw aria-hidden className="size-4" /> دوباره
            </button>
          ) : (
            <button type="submit" disabled={!ready} className="btn-primary btn-sm shrink-0">
              <ClipboardCheck aria-hidden className="size-4" /> تصحیح آزمون
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
