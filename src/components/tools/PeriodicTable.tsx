"use client";

import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { Printer, Search } from "lucide-react";
import { Chem } from "@/components/seo/Chem";
import { faDigits, trimNum } from "@/lib/chem/common";
import { CATEGORY_FA, ELEMENTS, PHASE_FA, findElement, fullConfig, valenceElectrons, type Category, type ChemElement } from "@/lib/chem/elements";
import { EXAM_MASSES } from "@/lib/chem/masses";
import { cn } from "@/lib/utils";
import { CAT_COLOR, CAT_ORDER, cellPos, configChem, neighbor, rowEdge, searchElements } from "./pt-data";
import { useInitialParam, writeParam } from "./url-state";

/**
 * جزیره‌ی کلاینت جدول تناوبی: شبکه‌ی ۱۸ ستونی (در گوشی درون قاب خودش افقی اسکرول می‌شود، نه کل صفحه)،
 * رنگ دسته‌ها با راهنمای متنی، جست‌وجو، کادر مشخصات عنصر، حرکت با کلیدهای جهت‌نما و چاپ کامل یا خالی.
 * عنصر پیش‌فرض (کلر) در HTML سرور رندر می‌شود؛ ?e=Fe فقط پس از mount خوانده می‌شود.
 * چاپ: ویژگی data-pt-print روی <html> («full» یا «blank») و کلاس‌های print: تیلویند؛ globals.css تغییری نمی‌کند.
 */

const DEFAULT_Z = 17;
const BLANK_HIDE = "[html[data-pt-print=blank]_&]:print:invisible";

/** نماد یون به نحو Chem: Mg^2+ ، Cl^- */
const ionChem = (symbol: string, q: number) => `${symbol}^${Math.abs(q) === 1 ? "" : Math.abs(q)}${q > 0 ? "+" : "-"}`;

function massLabel(e: ChemElement) {
  return faDigits(e.massNumberOnly ? e.massText : trimNum(e.mass, 3));
}

/** آرایش الکترونی: هر زیرلایه یک تکه تا در گوشی بشکند و بیرون نزند */
function ConfigChem({ config }: { config: string }) {
  return (
    <span dir="ltr" className="inline-flex flex-wrap gap-x-1.5 gap-y-0.5">
      {configChem(config)
        .split(" ")
        .map((p, i) => (
          <Chem key={i} f={p} />
        ))}
    </span>
  );
}

function Detail({ e, molarMassPath }: { e: ChemElement; molarMassPath: string | null }) {
  const exam = EXAM_MASSES[e.symbol];
  const val = valenceElectrons(e);
  const rows: { k: string; v: ReactNode }[] = [
    { k: "عدد اتمی", v: faDigits(e.z) },
    {
      k: "جرم اتمی",
      v: (
        <>
          {faDigits(e.massText)} {e.massNumberOnly && <span className="text-xs font-normal text-white/55">(عدد جرمی پایدارترین ایزوتوپ)</span>}
          {exam !== undefined && <span className="block text-xs font-normal text-white/55">گردشده در مسئله‌ها: {faDigits(exam)}</span>}
        </>
      ),
    },
    { k: "دوره و گروه", v: `دوره‌ی ${faDigits(e.period)}، ${e.group ? `گروه ${faDigits(e.group)}` : e.z <= 71 ? "ردیف لانتانیدها" : "ردیف آکتینیدها"}` },
    { k: "دسته", v: <bdi dir="ltr">{e.block}</bdi> },
    { k: "نوع عنصر", v: CATEGORY_FA[e.category] },
    { k: "حالت در ۲۵ درجه", v: PHASE_FA[e.phase] },
    { k: "الکترونگاتیوی (پائولینگ)", v: e.electronegativity === null ? "—" : faDigits(e.electronegativity) },
    { k: "الکترون‌های ظرفیت", v: val === null ? "—" : faDigits(val) },
  ];
  return (
    <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
      <div
        style={{ "--c": CAT_COLOR[e.category] } as CSSProperties}
        className="flex size-28 flex-col items-center justify-center rounded-2xl border-2 border-[color-mix(in_oklab,var(--c)_60%,transparent)] bg-[color-mix(in_oklab,var(--c)_16%,transparent)]"
      >
        <span className="text-xs text-white/60">{faDigits(e.z)}</span>
        <bdi dir="ltr" className="text-4xl font-black">
          {e.symbol}
        </bdi>
        <span className="text-xs text-white/70">{massLabel(e)}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black">
          {e.fa} <bdi dir="ltr" className="text-base font-bold text-white/55">{e.en}</bdi>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">{CATEGORY_FA[e.category]}</span>
          {e.radioactive && <span className="chip border-amber/30 text-amber">پرتوزا</span>}
          {e.predicted && <span className="chip">داده‌ها پیش‌بینی‌شده</span>}
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.k} className="min-w-0 border-b border-white/5 pb-2">
              <dt className="text-xs text-white/50">{r.k}</dt>
              <dd className="mt-0.5 font-bold">{r.v}</dd>
            </div>
          ))}
          <div className="min-w-0 border-b border-white/5 pb-2 sm:col-span-2">
            <dt className="text-xs text-white/50">آرایش الکترونی{e.predicted ? " (پیش‌بینی‌شده)" : ""}</dt>
            <dd className="mt-0.5 font-bold">
              <ConfigChem config={e.config} />
            </dd>
          </div>
          {e.z <= 36 && (
            <div className="min-w-0 border-b border-white/5 pb-2 sm:col-span-2">
              <dt className="text-xs text-white/50">آرایش الکترونی گسترده</dt>
              <dd className="mt-0.5 font-bold">
                <ConfigChem config={fullConfig(e)} />
              </dd>
            </div>
          )}
          {e.ions.length > 0 && (
            <div className="min-w-0 pb-2 sm:col-span-2">
              <dt className="text-xs text-white/50">یون‌های رایج</dt>
              <dd className="mt-0.5 flex flex-wrap gap-3 font-bold">
                {e.ions.map((q) => (
                  <Chem key={q} f={ionChem(e.symbol, q)} />
                ))}
              </dd>
            </div>
          )}
        </dl>
        {molarMassPath && (
          <p className="mt-3 text-sm">
            <Link href={molarMassPath} className="font-bold text-cyan underline-offset-4 hover:underline">
              جرم مولی ترکیب‌های {e.fa} را با ماشین‌حساب جرم مولی حساب کنید
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function PeriodicTable({ molarMassPath }: { molarMassPath: string | null }) {
  const id = useId();
  const [selected, setSelected] = useState(DEFAULT_Z);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const refs = useRef<Record<number, HTMLButtonElement | null>>({});

  useInitialParam("e", (v) => {
    const el = findElement(v);
    if (el) setSelected(el.z);
  });

  const matches = useMemo(() => searchElements(query), [query]);
  const matchSet = useMemo(() => new Set(matches.map((m) => m.z)), [matches]);
  const sel = ELEMENTS[selected - 1];

  const choose = (z: number, focus = false) => {
    setSelected(z);
    writeParam("e", z === DEFAULT_Z ? null : ELEMENTS[z - 1].symbol);
    if (focus) refs.current[z]?.focus();
  };

  const onKey = (ev: KeyboardEvent, z: number) => {
    let t: number | null = null;
    if (ev.key === "ArrowRight") t = neighbor(z, 0, 1);
    else if (ev.key === "ArrowLeft") t = neighbor(z, 0, -1);
    else if (ev.key === "ArrowUp") t = neighbor(z, -1, 0);
    else if (ev.key === "ArrowDown") t = neighbor(z, 1, 0);
    else if (ev.key === "Home") t = rowEdge(z, false);
    else if (ev.key === "End") t = rowEdge(z, true);
    else return;
    ev.preventDefault();
    if (t) choose(t, true);
  };

  const printAs = (mode: "full" | "blank") => {
    const root = document.documentElement;
    root.dataset.ptPrint = mode;
    const done = () => {
      delete root.dataset.ptPrint;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  const status = query.trim() ? (matches.length ? `${faDigits(matches.length)} عنصر پیدا شد؛ Enter نخستین را انتخاب می‌کند.` : "عنصری پیدا نشد.") : "";

  return (
    <section aria-labelledby={`${id}-h`} className="mb-4">
      <h2 id={`${id}-h`} className="sr-only">
        جدول تناوبی تعاملی
      </h2>

      {/* نوار ابزار: جست‌وجو و چاپ */}
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor={`${id}-q`} className="label">
            جست‌وجوی عنصر (نام فارسی، نام انگلیسی، نماد یا عدد اتمی)
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              id={`${id}-q`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  choose(matches[0].z, true);
                }
              }}
              autoComplete="off"
              placeholder="مثلاً آهن، Fe یا ۲۶"
              aria-describedby={`${id}-status`}
              className="input pr-10"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => printAs("full")} className="btn-ghost btn-sm">
            <Printer aria-hidden className="size-4" /> چاپ جدول کامل
          </button>
          <button type="button" onClick={() => printAs("blank")} className="btn-ghost btn-sm">
            <Printer aria-hidden className="size-4" /> چاپ جدول خالی
          </button>
        </div>
      </div>
      <p id={`${id}-status`} role="status" className="mb-2 min-h-5 text-xs text-white/60 print:hidden">
        {status}
      </p>

      {/* راهنمای رنگ (دکمه‌ی هر دسته، عنصرهای همان دسته را پررنگ می‌کند) */}
      <div role="group" aria-label="راهنمای رنگ دسته‌ها" className="mb-4 flex flex-wrap gap-1.5 [html[data-pt-print=blank]_&]:print:hidden">
        {CAT_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat((x) => (x === c ? null : c))}
            style={{ "--c": CAT_COLOR[c] } as CSSProperties}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition print:px-1.5 print:py-0 print:text-[8px]",
              cat === c ? "border-[var(--c)] bg-[color-mix(in_oklab,var(--c)_22%,transparent)] text-white" : "border-white/10 bg-white/[.03] text-white/75 hover:bg-white/[.07]",
            )}
          >
            <span aria-hidden className="size-2.5 rounded-sm bg-[var(--c)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]" />
            {CATEGORY_FA[c]}
          </button>
        ))}
      </div>

      {/* شبکه‌ی جدول: قاب خودش افقی اسکرول می‌شود؛ جهت جدول مثل همه‌ی جدول‌ها چپ‌به‌راست است */}
      <div dir="ltr" className="-mx-5 overflow-x-auto px-5 pb-3 sm:mx-0 sm:px-0 print:m-0 print:overflow-visible print:p-0">
        <div
          className="grid min-w-[60rem] gap-[3px] [grid-template-columns:1.25rem_repeat(18,minmax(0,1fr))] [grid-template-rows:auto_repeat(7,minmax(3.6rem,auto))_0.6rem_repeat(2,minmax(3.6rem,auto))] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:min-w-0 print:[grid-template-rows:auto_repeat(7,minmax(2.6rem,auto))_0.3rem_repeat(2,minmax(2.6rem,auto))]"
        >
          {/* شماره‌ی گروه‌ها و دوره‌ها */}
          {Array.from({ length: 18 }, (_, i) => (
            <span key={`g${i}`} aria-hidden style={{ gridRow: 1, gridColumn: i + 2 }} className="pb-0.5 text-center text-[10px] font-bold text-white/40">
              {faDigits(i + 1)}
            </span>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <span key={`p${i}`} aria-hidden style={{ gridRow: i + 2, gridColumn: 1 }} className="grid place-items-center text-[10px] font-bold text-white/40">
              {faDigits(i + 1)}
            </span>
          ))}

          {/* خلاصه‌ی عنصر انتخاب‌شده در جای خالی بالای فلزهای واسطه (تکرار کادر زیر؛ برای صفحه‌خوان پنهان) */}
          <div aria-hidden style={{ gridRow: "2 / 5", gridColumn: "4 / 14", "--c": CAT_COLOR[sel.category] } as CSSProperties} className="hidden items-center gap-4 px-3 md:flex print:hidden">
            <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-[color-mix(in_oklab,var(--c)_60%,transparent)] bg-[color-mix(in_oklab,var(--c)_16%,transparent)]">
              <span className="text-[10px] text-white/60">{faDigits(sel.z)}</span>
              <span className="text-2xl font-black">{sel.symbol}</span>
            </div>
            <div dir="rtl" className="min-w-0 text-right">
              <p className="truncate text-lg font-black">
                {sel.fa} <span className="text-sm font-bold text-white/50">{sel.en}</span>
              </p>
              <p className="text-xs text-white/60">
                {CATEGORY_FA[sel.category]} · جرم اتمی {faDigits(sel.massText)}
              </p>
              <p className="mt-1 text-sm">
                <ConfigChem config={sel.config} />
              </p>
            </div>
          </div>

          {/* جای لانتانیدها و آکتینیدها در دوره‌های ۶ و ۷ */}
          {[
            { row: 7, text: "۵۷–۷۱", c: "lanthanide" as Category },
            { row: 8, text: "۸۹–۱۰۳", c: "actinide" as Category },
          ].map((p) => (
            <span
              key={p.row}
              style={{ gridRow: p.row, gridColumn: 4, "--c": CAT_COLOR[p.c] } as CSSProperties}
              className="grid place-items-center rounded-lg border border-dashed border-[color-mix(in_oklab,var(--c)_50%,transparent)] text-[10px] text-white/55"
            >
              {p.text}
            </span>
          ))}
          <span style={{ gridRow: 10, gridColumn: "1 / 4" }} className="grid items-center pe-1 text-right text-[10px] font-bold text-white/50" dir="rtl">
            لانتانیدها
          </span>
          <span style={{ gridRow: 11, gridColumn: "1 / 4" }} className="grid items-center pe-1 text-right text-[10px] font-bold text-white/50" dir="rtl">
            آکتینیدها
          </span>

          {ELEMENTS.map((e) => {
            const { row, col } = cellPos(e);
            const isSel = e.z === selected;
            const dim = (query.trim() !== "" && !matchSet.has(e.z)) || (cat !== null && e.category !== cat);
            return (
              <button
                key={e.z}
                ref={(el) => {
                  refs.current[e.z] = el;
                }}
                type="button"
                tabIndex={isSel ? 0 : -1}
                aria-pressed={isSel}
                aria-label={`${e.fa}، ${e.en}، نماد ${e.symbol}، عدد اتمی ${faDigits(e.z)}، ${CATEGORY_FA[e.category]}`}
                title={`${e.fa} (${e.en})`}
                onClick={() => choose(e.z)}
                onKeyDown={(ev) => onKey(ev, e.z)}
                style={{ gridRow: row, gridColumn: col, "--c": CAT_COLOR[e.category] } as CSSProperties}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-1 leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 print:rounded-sm print:py-0.5",
                  "border-[color-mix(in_oklab,var(--c)_42%,transparent)] bg-[color-mix(in_oklab,var(--c)_13%,transparent)] hover:bg-[color-mix(in_oklab,var(--c)_28%,transparent)]",
                  "[html[data-pt-print=blank]_&]:print:border-neutral-400 [html[data-pt-print=blank]_&]:print:bg-transparent",
                  isSel && "z-10 bg-[color-mix(in_oklab,var(--c)_32%,transparent)] ring-2 ring-[var(--c)] print:bg-[color-mix(in_oklab,var(--c)_13%,transparent)] print:ring-0",
                  dim && "opacity-25 print:opacity-100",
                )}
              >
                <span className={cn("self-start ps-0.5 text-[9px] text-white/60 print:text-[6px]", BLANK_HIDE)}>{faDigits(e.z)}</span>
                <span className={cn("text-[15px] font-black text-[color-mix(in_oklab,var(--c)_55%,var(--color-white))] print:text-[10px]", BLANK_HIDE)}>
                  {e.symbol}
                </span>
                <span dir="rtl" className={cn("w-full truncate text-center text-[9px] text-white/80 print:text-[6px]", BLANK_HIDE)}>
                  {e.fa}
                </span>
                <span className={cn("hidden text-[8px] text-white/50 xl:block print:block print:text-[5.5px]", BLANK_HIDE)}>{massLabel(e)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-white/55 sm:hidden print:hidden">جدول را برای دیدن همه‌ی گروه‌ها به چپ و راست بکشید.</p>

      {/* کادر مشخصات عنصر */}
      <div aria-live="polite" className="card mt-6 p-5 sm:p-6 print:hidden">
        <Detail e={sel} molarMassPath={molarMassPath} />
      </div>
    </section>
  );
}
