"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { CircleCheck, Scale } from "lucide-react";
import { Chem, Eq, chemTextPlain } from "@/components/seo/Chem";
import { faDigits } from "@/lib/chem/common";
import { balanceEquation } from "@/lib/chem/balance";
import { cn } from "@/lib/utils";
import { ErrorBox, StepList, Warnings } from "./ToolBits";
import { RichText } from "./RichText";
import { useInitialParam, writeParam } from "./url-state";

/**
 * جزیره‌ی کلاینت موازنه‌ی معادله: ضریب‌ها با حل دقیق دستگاه پایستگی اتم‌ها (و بار)، جدول وارسی و مراحل.
 * نتیجه‌ی معادله‌ی پیش‌فرض در HTML سرور رندر می‌شود؛ ?e= فقط پس از mount خوانده می‌شود.
 */

/** بار خالص با علامت: «+۱۷»، «−۲»، «۰» */
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${faDigits(Math.abs(n))}`;

const INSERTS: { label: string; text: string; aria: string }[] = [
  { label: "+", text: " + ", aria: "درج علامت جمع" },
  { label: "→", text: " -> ", aria: "درج پیکان یک‌طرفه" },
  { label: "⇌", text: " <=> ", aria: "درج پیکان تعادلی" },
  { label: "^", text: "^", aria: "درج نشانه‌ی بار" },
  { label: "·", text: "·", aria: "درج جداکننده‌ی آب تبلور" },
];

export function BalanceTool({ examples, initial }: { examples: string[]; initial: string }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);

  useInitialParam("e", (v) => {
    setInput(v);
    setSubmitted(v);
  });

  const result = useMemo(() => (submitted.trim() ? balanceEquation(submitted) : null), [submitted]);

  useEffect(() => {
    if (!result?.ok) return;
    const eq = submitted.trim();
    writeParam("e", eq === initial ? null : eq);
  }, [result, submitted, initial]);

  const run = (eq: string) => {
    setInput(eq);
    setSubmitted(eq);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(input);
  };
  const insert = (text: string) => {
    const el = ref.current;
    if (!el) return setInput((v) => v + text);
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const next = input.slice(0, start) + text + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  return (
    <section aria-labelledby={`${id}-h`} className="card mb-4 p-5 sm:p-7 print:hidden">
      <h2 id={`${id}-h`} className="mb-5 flex items-center gap-2 text-xl font-black">
        <Scale aria-hidden className="size-5 text-cyan" /> موازنه‌گر معادله
      </h2>

      <form onSubmit={onSubmit}>
        <label htmlFor={`${id}-e`} className="label">
          معادله‌ی واکنش (بدون ضریب)
        </label>
        <input
          ref={ref}
          id={`${id}-e`}
          type="text"
          dir="ltr"
          lang="en"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="C3H8 + O2 -> CO2 + H2O"
          aria-describedby={`${id}-hint`}
          aria-invalid={result !== null && !result.ok}
          className="input text-left text-base font-bold sm:text-lg"
        />
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-6 text-white/50">
          <RichText text="پیکان: `->` یا `=` ؛ بار یون: `Fe^3+` ؛ کلید Enter هم موازنه می‌کند." />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary">
            موازنه کن
          </button>
          <div role="group" aria-label="درج نشانه" className="flex flex-wrap gap-1.5">
            {INSERTS.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => insert(b.text)}
                aria-label={b.aria}
                className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-lg font-bold text-white/80 hover:bg-white/10"
              >
                <bdi dir="ltr" className="chem">{b.label}</bdi>
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="نمونه‌های آماده">
        {examples.map((eq) => (
          <button
            key={eq}
            type="button"
            onClick={() => run(eq)}
            aria-label={`نمونه: ${chemTextPlain(`{{${eq}}}`)}`}
            aria-pressed={submitted.trim() === eq}
            className={cn(
              "chip max-w-full whitespace-normal px-3 py-1.5 text-start text-xs transition hover:border-cyan/40 hover:text-white",
              submitted.trim() === eq && "border-cyan/50 bg-cyan/15 text-white",
            )}
          >
            <Eq f={eq} block={false} />
          </button>
        ))}
      </div>

      <div className="mt-6">
        {result && !result.ok && <ErrorBox error={result.error} extra={result.warnings} />}
        {result?.ok && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <div aria-live="polite" className="rounded-2xl border border-cyan/25 bg-cyan/[.07] p-4">
                <p className="flex items-center gap-1.5 text-sm text-white/65">
                  <CircleCheck aria-hidden className="size-4 text-teal" /> معادله‌ی موازنه‌شده
                  {result.ionic && <span className="chip mr-1">یونی؛ بار هم موازنه شد</span>}
                </p>
                <Eq f={result.equation} className="!my-2 text-lg font-bold text-white sm:text-xl" />
                <p className="text-xs leading-6 text-white/55">
                  ضریب‌ها به ترتیب: {result.coefficients.map((c) => faDigits(c)).join("، ")}
                </p>
              </div>
              <div className="table-wrap mt-4">
                <table className="table">
                  <caption className="sr-only">شمارش اتم‌ها و بار در دو طرف معادله‌ی موازنه‌شده</caption>
                  <thead>
                    <tr>
                      <th scope="col">عنصر</th>
                      <th scope="col">واکنش‌دهنده‌ها</th>
                      <th scope="col">فراورده‌ها</th>
                      <th scope="col">
                        <span className="sr-only">وضعیت</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tally.map((t) => (
                      <tr key={t.key}>
                        <td className="font-bold">{t.key === "charge" ? "بار کل" : <Chem f={t.key} />}</td>
                        <td>{t.key === "charge" ? <bdi dir="ltr">{signed(t.left)}</bdi> : faDigits(t.left)}</td>
                        <td>{t.key === "charge" ? <bdi dir="ltr">{signed(t.right)}</bdi> : faDigits(t.right)}</td>
                        <td>
                          {t.left === t.right ? (
                            <>
                              <CircleCheck aria-hidden className="size-4 text-teal" />
                              <span className="sr-only">برابر</span>
                            </>
                          ) : (
                            <span className="text-rose">نابرابر</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Warnings items={result.warnings} className="mt-4" />
            </div>
            <details open className="min-w-0">
              <summary className="mb-3 cursor-pointer text-sm font-black text-white/80 marker:text-cyan">مراحل حل (روش جبری)</summary>
              <StepList steps={result.steps} />
            </details>
          </div>
        )}
      </div>
    </section>
  );
}
