"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Timer, Loader2, Send, PlayCircle, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { faNum, fmtClock } from "@/lib/utils";

interface Q { id: string; text: string; image: string | null; options: string[] }
type Answers = Record<string, number | null>;
const LABELS = ["۱", "۲", "۳", "۴"];

export function ExamRunner({ examId, title, count, durationMin, negative, resumable }: { examId: string; title: string; count: number; durationMin: number; negative: boolean; resumable: boolean }) {
  const router = useRouter();
  const [qs, setQs] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const deadline = useRef(0);
  const offset = useRef(0);
  const dirty = useRef(false);
  const submitted = useRef(false);
  const key = `exam:${examId}`;

  const start = async () => {
    setBusy(true);
    const r = await fetch(`/api/exams/${examId}/start`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast.err(d.error || "خطا");
    offset.current = d.now - Date.now();
    deadline.current = d.deadline;
    let saved: Answers = d.answers || {};
    try {
      const local = JSON.parse(localStorage.getItem(key) || "null");
      if (local) saved = { ...saved, ...local };
    } catch {}
    setAnswers(saved);
    setQs(d.questions);
  };

  const submit = useCallback(async (auto = false) => {
    if (submitted.current) return;
    if (!auto && !confirm("پاسخ‌نامه ارسال شود؟ بعد از ارسال امکان تغییر نیست.")) return;
    submitted.current = true;
    setBusy(true);
    const r = await fetch(`/api/exams/${examId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
    if (r.ok) {
      try { localStorage.removeItem(key); } catch {}
      toast.ok(auto ? "زمان تمام شد؛ پاسخ‌نامه ارسال شد" : "پاسخ‌نامه ثبت شد 🎯");
      router.refresh();
    } else {
      submitted.current = false;
      setBusy(false);
      toast.err("ارسال ناموفق بود؛ دوباره تلاش کنید");
    }
  }, [answers, examId, key, router]);

  // تایمر
  useEffect(() => {
    if (!qs) return;
    const tick = () => {
      const l = Math.max(0, Math.floor((deadline.current - (Date.now() + offset.current)) / 1000));
      setLeft(l);
      if (l <= 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qs, submit]);

  // ذخیره خودکار
  useEffect(() => {
    if (!qs) return;
    const t = setInterval(() => {
      if (!dirty.current || submitted.current) return;
      dirty.current = false;
      fetch(`/api/exams/${examId}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) }).catch(() => (dirty.current = true));
    }, 15000);
    return () => clearInterval(t);
  }, [qs, answers, examId]);

  const pick = (qid: string, i: number) => {
    setAnswers((a) => {
      const n = { ...a, [qid]: a[qid] === i ? null : i };
      try { localStorage.setItem(key, JSON.stringify(n)); } catch {}
      return n;
    });
    dirty.current = true;
  };

  if (!qs)
    return (
      <div className="card glow-border mx-auto max-w-xl p-8 text-center">
        <PlayCircle className="mx-auto mb-4 size-14 text-cyan" strokeWidth={1.3} />
        <h1 className="mb-2 text-2xl font-black">{title}</h1>
        <p className="mb-6 text-white/60">{faNum(count)} سؤال · {faNum(durationMin)} دقیقه</p>
        <ul className="mb-6 space-y-2 text-right text-sm text-white/65">
          <li>• با زدن «شروع»، زمان آزمون شروع می‌شود و متوقف نمی‌شود.</li>
          {negative && <li>• هر پاسخ غلط، یک‌سوم نمره‌ی یک سؤال را کم می‌کند (مثل کنکور).</li>}
          <li>• پاسخ‌ها خودکار ذخیره می‌شوند؛ اگر اینترنت قطع شد نگران نباش.</li>
          <li>• با پایان زمان، پاسخ‌نامه خودکار ارسال می‌شود.</li>
        </ul>
        <button onClick={start} disabled={busy} className="btn-primary w-full !py-4 text-base">
          {busy ? <Loader2 className="size-5 animate-spin" /> : resumable ? "ادامه‌ی آزمون" : "شروع آزمون"}
        </button>
      </div>
    );

  const answered = qs.filter((q) => answers[q.id] !== null && answers[q.id] !== undefined).length;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="glass sticky top-3 z-30 mb-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className={`flex items-center gap-2 text-lg font-black ${left < 60 ? "animate-pulse text-rose" : "text-white"}`}>
          <Timer className="size-5" /> {fmtClock(left)}
        </div>
        <div className="hidden flex-1 sm:block">
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-l from-cyan to-violet transition-all" style={{ width: `${(answered / qs.length) * 100}%` }} /></div>
        </div>
        <span className="text-xs text-white/60">{faNum(answered)} از {faNum(qs.length)}</span>
        <button onClick={() => submit(false)} disabled={busy} className="btn-primary btn-sm">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} ارسال</button>
      </div>

      <div className="space-y-4">
        {qs.map((q, qi) => (
          <motion.div key={q.id} id={`q-${qi}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(qi * 0.03, 0.5) }} className="card scroll-mt-24 p-5">
            <p className="mb-4 leading-8"><span className="ml-2 inline-grid size-7 place-items-center rounded-lg bg-white/10 text-sm font-black">{faNum(qi + 1)}</span>{q.text}</p>
            {q.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image} alt="" className="mb-4 max-h-80 rounded-xl bg-white p-2" />
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, i) => {
                const on = answers[q.id] === i;
                return (
                  <button key={i} onClick={() => pick(q.id, i)} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-right text-sm transition ${on ? "border-cyan/60 bg-cyan/15 text-white shadow-[0_0_24px_-8px_rgba(34,211,238,.7)]" : "border-white/10 bg-white/[.03] text-white/80 hover:bg-white/[.07]"}`}>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-black ${on ? "bg-cyan text-ink" : "bg-white/10"}`}>{LABELS[i]}</span>
                    <span dir="auto">{o}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <p className="mb-3 text-sm font-bold">پاسخ‌برگ</p>
        <div className="flex flex-wrap gap-1.5">
          {qs.map((q, i) => (
            <a key={q.id} href={`#q-${i}`} className={`grid size-9 place-items-center rounded-lg text-xs font-bold ${answers[q.id] !== null && answers[q.id] !== undefined ? "bg-gradient-to-br from-cyan to-violet text-white" : "bg-white/5 text-white/50"}`}>{faNum(i + 1)}</a>
          ))}
        </div>
        {answered < qs.length && <p className="mt-3 flex items-center gap-1 text-xs text-amber"><AlertTriangle className="size-3.5" /> {faNum(qs.length - answered)} سؤال بی‌پاسخ</p>}
        <button onClick={() => submit(false)} disabled={busy} className="btn-primary mt-4 w-full">ارسال پاسخ‌نامه</button>
      </div>
    </div>
  );
}

export function LaunchExternal({ examId, mode, url }: { examId: string; mode: string; url: string }) {
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const r = await fetch(`/api/exams/${examId}/launch`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast.err(d.error || "خطا");
    if (mode === "IFRAME") setFrame(d.url);
    else window.open(d.url, "_blank", "noopener");
  };
  return (
    <div>
      <button onClick={go} disabled={busy} className="btn-primary !px-8 !py-4 text-base">{busy ? <Loader2 className="size-5 animate-spin" /> : <PlayCircle className="size-5" />} ورود به آزمون</button>
      {frame && (
        <div className="mt-5">
          <iframe src={frame} className="h-[80dvh] w-full rounded-2xl border border-white/10 bg-white" allow="fullscreen" />
          <a href={url} target="_blank" rel="noopener" className="mt-2 inline-block text-xs text-cyan">اگر آزمون نمایش داده نشد، اینجا بزنید تا در صفحه‌ی جدید باز شود</a>
        </div>
      )}
    </div>
  );
}
