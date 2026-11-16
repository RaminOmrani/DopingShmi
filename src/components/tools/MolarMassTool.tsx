"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Calculator, Eraser } from "lucide-react";
import { Chem, chemPlain } from "@/components/seo/Chem";
import { faDigits, trimNum } from "@/lib/chem/common";
import { convertAmount, molarMass, type AmountUnit, type MassMode } from "@/lib/chem/molar-mass";
import { cn } from "@/lib/utils";
import { Choice, ErrorBox, Num, StepList, Warnings } from "./ToolBits";
import { RichText } from "./RichText";
import { useInitialParam, writeParam } from "./url-state";

/**
 * جزیره‌ی کلاینت ماشین‌حساب جرم مولی: فرمول → جدول «تعداد × جرم اتمی = سهم»، مراحل حل و تبدیل گرم/مول/ذره.
 * فقط نقشه‌ی جرم‌ها (masses.ts) و تجزیه‌گر فرمول بارگیری می‌شود، نه داده‌ی کامل عنصرها.
 * نتیجه‌ی فرمول پیش‌فرض در HTML سرور رندر می‌شود؛ ?f= فقط پس از mount خوانده می‌شود.
 */

const UNIT_LABEL: Record<AmountUnit, string> = { g: "گرم", mol: "مول", particles: "تعداد ذره" };

export function MolarMassTool({ examples, initial }: { examples: string[]; initial: string }) {
  const id = useId();
  const [input, setInput] = useState(initial);
  const [mode, setMode] = useState<MassMode>("precise");
  const [amount, setAmount] = useState("10");
  const [unit, setUnit] = useState<AmountUnit>("g");

  useInitialParam("f", setInput);

  const trimmed = input.trim();
  const result = useMemo(() => (trimmed ? molarMass(trimmed, { mode }) : null), [trimmed, mode]);
  const ok = result?.ok ? result : null;

  // نتیجه‌ی موفق در نشانی (برای اشتراک‌گذاری)؛ canonical همان نشانی ساده است
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => writeParam("f", trimmed === initial ? null : trimmed), 700);
    return () => clearTimeout(t);
  }, [ok, trimmed, initial]);

  const conv = useMemo(
    () => (ok && amount.trim() ? convertAmount({ value: amount, from: unit, molarMass: ok.value, formula: ok.formula.body }) : null),
    [ok, amount, unit],
  );

  return (
    <section aria-labelledby={`${id}-h`} className="card mb-4 p-5 sm:p-7 print:hidden">
      <h2 id={`${id}-h`} className="mb-5 flex items-center gap-2 text-xl font-black">
        <Calculator aria-hidden className="size-5 text-cyan" /> ماشین‌حساب جرم مولی
      </h2>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <label htmlFor={`${id}-f`} className="label">
            فرمول شیمیایی
          </label>
          <div className="relative">
            <input
              id={`${id}-f`}
              dir="ltr"
              lang="en"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Ca(OH)2"
              aria-describedby={`${id}-hint`}
              aria-invalid={result !== null && !result.ok}
              className="input pe-4 ps-11 text-left text-lg font-bold tracking-wide"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput("")}
                className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-white/45 hover:bg-white/10 hover:text-white"
                aria-label="پاک کردن فرمول"
              >
                <Eraser aria-hidden className="size-4" />
              </button>
            )}
          </div>
          <p id={`${id}-hint`} className="mt-1.5 text-xs leading-6 text-white/50">
            <RichText text="پرانتز، کروشه و آب تبلور با نقطه یا ستاره: `CuSO4.5H2O`" />
          </p>
        </div>
        <Choice
          name={`${id}-mode`}
          legend="جرم اتمی عنصرها"
          value={mode}
          onChange={setMode}
          options={[
            { value: "precise", label: "دقیق (آیوپاک)" },
            { value: "exam", label: "گردشده‌ی امتحانی" },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="نمونه‌های آماده">
        {examples.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setInput(f)}
            aria-label={`نمونه: ${chemPlain(f)}`}
            aria-pressed={trimmed === f}
            className={cn("chip px-3 py-1.5 text-xs transition hover:border-cyan/40 hover:text-white", trimmed === f && "border-cyan/50 bg-cyan/15 text-white")}
          >
            <Chem f={f} />
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          {!result && <p className="text-sm text-white/55">یک فرمول بنویسید یا یکی از نمونه‌ها را انتخاب کنید.</p>}
          {result && !result.ok && <ErrorBox error={result.error} />}
          {ok && (
            <>
              <div aria-live="polite" className="rounded-2xl border border-cyan/25 bg-cyan/[.07] p-4">
                <p className="text-sm text-white/65">
                  جرم مولی <Chem f={ok.formula.display} className="font-bold text-white" />
                  {mode === "exam" ? " (جرم‌های گردشده)" : ""}
                </p>
                <p className="mt-1 text-3xl font-black text-white sm:text-4xl">
                  {faDigits(ok.valueText)} <span className="text-base font-bold text-white/60">گرم بر مول</span>
                </p>
              </div>
              <div className="table-wrap mt-4">
                <table className="table text-xs sm:text-sm">
                  <caption className="sr-only">سهم هر عنصر در جرم مولی؛ جرم‌ها بر حسب گرم بر مول</caption>
                  <thead>
                    <tr>
                      <th scope="col">عنصر</th>
                      <th scope="col">تعداد</th>
                      <th scope="col">جرم مولی عنصر</th>
                      <th scope="col">سهم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ok.rows.map((r) => (
                      <tr key={r.symbol}>
                        <td className="font-bold">
                          <Chem f={r.symbol} />
                        </td>
                        <td>{faDigits(r.count)}</td>
                        <td>
                          {faDigits(trimNum(r.mass, 10))}
                          {r.massNumberOnly ? " *" : ""}
                        </td>
                        <td className="font-bold">{faDigits(trimNum(r.subtotal, 6))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="border-t border-white/10 px-3 py-3 font-black">
                        جمع
                      </td>
                      <td className="border-t border-white/10 px-3 py-3 font-black text-cyan">{faDigits(ok.valueText)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Warnings items={ok.warnings} className="mt-4" />
            </>
          )}
        </div>

        {ok && (
          <details open className="group min-w-0">
            <summary className="mb-3 cursor-pointer text-sm font-black text-white/80 marker:text-cyan">مراحل حل</summary>
            <StepList steps={ok.steps} />
          </details>
        )}
      </div>

      {ok && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <h3 className="mb-4 text-lg font-black">
            تبدیل مقدار <Chem f={ok.formula.body} />: گرم، مول و تعداد ذره
          </h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,10rem)]">
            <div>
              <label htmlFor={`${id}-amt`} className="label">
                مقدار
              </label>
              <input
                id={`${id}-amt`}
                dir="ltr"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input text-left font-bold"
              />
            </div>
            <div>
              <label htmlFor={`${id}-unit`} className="label">
                یکا
              </label>
              <select id={`${id}-unit`} value={unit} onChange={(e) => setUnit(e.target.value as AmountUnit)} className="input">
                {(Object.keys(UNIT_LABEL) as AmountUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {conv && !conv.ok && <ErrorBox error={conv.error} className="mt-4" />}
          {conv?.ok && (
            <>
              <dl aria-live="polite" className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { k: "جرم", v: <><Num value={conv.grams} /> گرم</> },
                  { k: "مقدار ماده", v: <><Num value={conv.moles} /> مول</> },
                  { k: "تعداد ذره", v: <Num value={conv.particles} /> },
                ].map((x) => (
                  <div key={x.k} className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
                    <dt className="text-xs text-white/55">{x.k}</dt>
                    <dd className="mt-1 text-lg font-black">{x.v}</dd>
                  </div>
                ))}
              </dl>
              <StepList steps={conv.steps} className="mt-4" />
              <p className="mt-3 text-xs leading-6 text-white/50">
                جرم مولی به‌کاررفته: {faDigits(ok.valueText)} گرم بر مول؛ عدد آووگادرو مثل کتاب درسی <Num value={6.02e23} /> گرفته شده است.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
