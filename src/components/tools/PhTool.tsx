"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { Chem, chemPlain } from "@/components/seo/Chem";
import { faDigits, trimNum } from "@/lib/chem/common";
import { convertPh, PH_PRESETS, strongAcid, strongBase, weakAcid, weakBase, type PhQuantity, type PhResult } from "@/lib/chem/ph";
import { cn } from "@/lib/utils";
import { Choice, ErrorBox, Num, StepList, Warnings } from "./ToolBits";

/**
 * جزیره‌ی کلاینت ماشین‌حساب pH با سه زبانه: اسید و باز قوی، اسید و باز ضعیف (تقریبی و دقیق)، تبدیل pH و غلظت.
 * هر سه زبانه با مقدار پیش‌فرض در HTML سرور رندر می‌شوند (زبانه‌های غیرفعال با hidden).
 */

type Tab = "strong" | "weak" | "convert";
type Side = "acid" | "base";

const TABS: { key: Tab; label: string }[] = [
  { key: "strong", label: "اسید و باز قوی" },
  { key: "weak", label: "اسید و باز ضعیف" },
  { key: "convert", label: "تبدیل pH و غلظت" },
];

const CUSTOM = "custom";
const NATURE_FA = { acidic: "اسیدی", neutral: "خنثی", basic: "بازی" } as const;
const NATURE_CLS = { acidic: "border-rose/30 bg-rose/10 text-rose", neutral: "border-teal/30 bg-teal/10 text-teal", basic: "border-violet/30 bg-violet/10 text-violet" } as const;

const presetsOf = (kind: "strong-acid" | "strong-base" | "weak-acid" | "weak-base") => PH_PRESETS.filter((p) => p.kind === kind);
/** نمایش K برای ورودی: 1.8e-5 */
const kInput = (k: number) => k.toExponential(1).replace("+", "");

function Field({ id, label, children, hint }: { id: string; label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-5 text-white/45">{hint}</p>}
    </div>
  );
}

/** نمایش نتیجه‌ی مشترک هر سه زبانه */
function PhResultView({ r }: { r: PhResult | null }) {
  if (!r) return null;
  if (!r.ok) return <ErrorBox error={r.error} className="mt-5" />;
  const cells: { k: ReactNode; v: ReactNode }[] = [
    { k: "pOH", v: <Num value={r.pOH} fixed={2} /> },
    { k: <>غلظت یون هیدروژن <Chem f="[H^+]" /></>, v: <><Num value={r.H} sig={3} /> <span className="text-xs font-normal text-white/50">مول بر لیتر</span></> },
    { k: <>غلظت یون هیدروکسید <Chem f="[OH^-]" /></>, v: <><Num value={r.OH} sig={3} /> <span className="text-xs font-normal text-white/50">مول بر لیتر</span></> },
  ];
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="min-w-0">
        <div aria-live="polite" className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-cyan/25 bg-cyan/[.07] p-4">
          <p>
            <span className="block text-sm text-white/65">pH محلول</span>
            <span className="text-4xl font-black text-white">
              <Num value={r.pH} fixed={2} />
            </span>
          </p>
          <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", NATURE_CLS[r.nature])}>{NATURE_FA[r.nature]}</span>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {cells.map((c, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
              <dt className="text-xs text-white/55">{c.k}</dt>
              <dd className="mt-1 text-base font-black">{c.v}</dd>
            </div>
          ))}
        </dl>
        {r.weak && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className={cn("rounded-2xl border p-3 text-sm leading-7", r.weak.approxValid ? "border-teal/30 bg-teal/[.07]" : "border-amber/30 bg-amber/[.07]")}>
              <p className="font-bold">روش تقریبی</p>
              <p className="text-white/75">
                pH ≈ <Num value={r.weak.approx.pH} fixed={2} />، درجه‌ی یونش {faDigits(trimNum(r.weak.approx.alpha * 100, 2))}٪
              </p>
              <p className={cn("text-xs", r.weak.approxValid ? "text-teal" : "text-amber")}>
                {r.weak.approxValid ? "کمتر از ۵٪؛ تقریب پذیرفتنی است." : "بیشتر از ۵٪؛ تقریب پذیرفتنی نیست."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3 text-sm leading-7">
              <p className="font-bold">جواب دقیق (معادله‌ی درجه دوم)</p>
              <p className="text-white/75">
                pH = <Num value={r.weak.exact.pH} fixed={2} />، درجه‌ی یونش {faDigits(trimNum(r.weak.exact.alpha * 100, 2))}٪
              </p>
            </div>
          </div>
        )}
        <Warnings items={r.warnings} className="mt-3" />
      </div>
      <details open className="min-w-0">
        <summary className="mb-3 cursor-pointer text-sm font-black text-white/80 marker:text-cyan">مراحل حل</summary>
        <StepList steps={r.steps} />
      </details>
    </div>
  );
}

function StrongPanel({ id }: { id: string }) {
  const [side, setSide] = useState<Side>("acid");
  const [preset, setPreset] = useState("HCl");
  const [n, setN] = useState("1");
  const [c, setC] = useState("0.01");
  const list = presetsOf(side === "acid" ? "strong-acid" : "strong-base");
  const p = list.find((x) => x.formula === preset);

  const changeSide = (s: Side) => {
    setSide(s);
    const first = presetsOf(s === "acid" ? "strong-acid" : "strong-base")[0];
    setPreset(first.formula);
    setN(String(first.n ?? 1));
  };
  const changePreset = (v: string) => {
    setPreset(v);
    const q = list.find((x) => x.formula === v);
    if (q) setN(String(q.n ?? 1));
  };
  const r = useMemo(() => {
    if (!c.trim()) return null;
    const o = { c, n, formula: p?.formula };
    return side === "acid" ? strongAcid(o) : strongBase(o);
  }, [side, c, n, p]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Choice
          name={`${id}-s-side`}
          legend="نوع ماده"
          value={side}
          onChange={changeSide}
          options={[
            { value: "acid", label: "اسید قوی" },
            { value: "base", label: "باز قوی" },
          ]}
        />
        <Field id={`${id}-s-p`} label="ماده">
          <select id={`${id}-s-p`} value={preset} onChange={(e) => changePreset(e.target.value)} className="input">
            {list.map((x) => (
              <option key={x.formula} value={x.formula}>
                {chemPlain(x.formula)}، {x.fa}
              </option>
            ))}
            <option value={CUSTOM}>{side === "acid" ? "اسید قوی دیگر" : "باز قوی دیگر"}</option>
          </select>
        </Field>
        <Field id={`${id}-s-n`} label={side === "acid" ? "تعداد یون هیدروژن در هر واحد" : "تعداد یون هیدروکسید در هر واحد"}>
          <select id={`${id}-s-n`} value={n} onChange={(e) => setN(e.target.value)} disabled={preset !== CUSTOM} className="input disabled:opacity-60">
            {["1", "2", "3", "4"].map((v) => (
              <option key={v} value={v}>
                {faDigits(v)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-s-c`} label="غلظت (مول بر لیتر)">
          <input id={`${id}-s-c`} dir="ltr" inputMode="decimal" autoComplete="off" value={c} onChange={(e) => setC(e.target.value)} className="input text-left font-bold" />
        </Field>
      </div>
      <PhResultView r={r} />
    </>
  );
}

function WeakPanel({ id }: { id: string }) {
  const [side, setSide] = useState<Side>("acid");
  const [preset, setPreset] = useState("CH3COOH");
  const [k, setK] = useState("1.8e-5");
  const [c, setC] = useState("0.1");
  const list = presetsOf(side === "acid" ? "weak-acid" : "weak-base");
  const p = list.find((x) => x.formula === preset);

  const changeSide = (s: Side) => {
    setSide(s);
    const first = presetsOf(s === "acid" ? "weak-acid" : "weak-base")[0];
    setPreset(first.formula);
    setK(kInput(first.k ?? 1e-5));
  };
  const changePreset = (v: string) => {
    setPreset(v);
    const q = list.find((x) => x.formula === v);
    if (q?.k) setK(kInput(q.k));
  };
  const r = useMemo(() => {
    if (!c.trim() || !k.trim()) return null;
    return side === "acid" ? weakAcid({ c, ka: k, formula: p?.formula }) : weakBase({ c, kb: k, formula: p?.formula });
  }, [side, c, k, p]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Choice
          name={`${id}-w-side`}
          legend="نوع ماده"
          value={side}
          onChange={changeSide}
          options={[
            { value: "acid", label: "اسید ضعیف" },
            { value: "base", label: "باز ضعیف" },
          ]}
        />
        <Field id={`${id}-w-p`} label="ماده">
          <select id={`${id}-w-p`} value={preset} onChange={(e) => changePreset(e.target.value)} className="input">
            {list.map((x) => (
              <option key={x.formula} value={x.formula}>
                {chemPlain(x.formula)}، {x.fa}
              </option>
            ))}
            <option value={CUSTOM}>{side === "acid" ? "اسید ضعیف دیگر" : "باز ضعیف دیگر"}</option>
          </select>
        </Field>
        <Field
          id={`${id}-w-k`}
          label={
            <>
              ثابت یونش <Chem f={side === "acid" ? "K_a" : "K_b"} />
            </>
          }
          hint="مقدار مرجع در ۲۵ درجه؛ اگر سؤال عدد دیگری داده، همان را بنویسید."
        >
          <input
            id={`${id}-w-k`}
            dir="ltr"
            autoComplete="off"
            value={k}
            onChange={(e) => {
              setK(e.target.value);
              setPreset(CUSTOM);
            }}
            className="input text-left font-bold"
          />
        </Field>
        <Field id={`${id}-w-c`} label="غلظت اولیه (مول بر لیتر)">
          <input id={`${id}-w-c`} dir="ltr" inputMode="decimal" autoComplete="off" value={c} onChange={(e) => setC(e.target.value)} className="input text-left font-bold" />
        </Field>
      </div>
      <PhResultView r={r} />
    </>
  );
}

const QTY: { value: PhQuantity; label: string }[] = [
  { value: "pH", label: "pH" },
  { value: "pOH", label: "pOH" },
  { value: "H", label: "غلظت یون هیدروژن" },
  { value: "OH", label: "غلظت یون هیدروکسید" },
];

function ConvertPanel({ id }: { id: string }) {
  const [from, setFrom] = useState<PhQuantity>("pH");
  const [v, setV] = useState("3");
  const r = useMemo(() => (v.trim() ? convertPh({ from, value: v }) : null), [from, v]);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <Field id={`${id}-c-f`} label="مقدار معلوم">
          <select id={`${id}-c-f`} value={from} onChange={(e) => setFrom(e.target.value as PhQuantity)} className="input">
            {QTY.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-c-v`} label={from === "H" || from === "OH" ? "مقدار (مول بر لیتر)" : "مقدار"}>
          <input id={`${id}-c-v`} dir="ltr" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} className="input text-left font-bold" />
        </Field>
      </div>
      <PhResultView r={r} />
    </>
  );
}

export function PhTool() {
  const id = useId();
  const [tab, setTab] = useState<Tab>("strong");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** کلیدهای جهت‌نما بین زبانه‌ها (راست‌به‌چپ: چپ = بعدی) */
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const last = TABS.length - 1;
    let j: number | null = null;
    if (e.key === "ArrowLeft") j = i === last ? 0 : i + 1;
    else if (e.key === "ArrowRight") j = i === 0 ? last : i - 1;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = last;
    if (j === null) return;
    e.preventDefault();
    setTab(TABS[j].key);
    tabRefs.current[j]?.focus();
  };

  return (
    <section aria-labelledby={`${id}-h`} className="card mb-4 p-5 sm:p-7 print:hidden">
      <h2 id={`${id}-h`} className="mb-5 flex items-center gap-2 text-xl font-black">
        <FlaskConical aria-hidden className="size-5 text-cyan" /> ماشین‌حساب pH
      </h2>
      <div role="tablist" aria-label="نوع محاسبه" className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`${id}-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-bold transition",
              tab === t.key ? "bg-cyan/15 text-white ring-1 ring-cyan/40" : "text-white/60 hover:bg-white/[.06] hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div key={t.key} role="tabpanel" id={`${id}-panel-${t.key}`} aria-labelledby={`${id}-tab-${t.key}`} hidden={tab !== t.key} tabIndex={0} className="outline-none">
          {t.key === "strong" && <StrongPanel id={id} />}
          {t.key === "weak" && <WeakPanel id={id} />}
          {t.key === "convert" && <ConvertPanel id={id} />}
        </div>
      ))}
      <p className="mt-6 text-xs leading-6 text-white/50">
        همه‌ی محاسبه‌ها برای دمای ۲۵ درجه‌ی سلسیوس و با <Chem f="K_w = 1.0 × 10^-14" /> انجام می‌شود.
      </p>
    </section>
  );
}
