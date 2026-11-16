import type { ReactNode } from "react";
import { AlertTriangle, CircleX } from "lucide-react";
import { ChemText } from "@/components/seo/Chem";
import { faDigits, sciParts, trimNum, type ChemStep } from "@/lib/chem/common";
import { cn } from "@/lib/utils";

/**
 * قطعه‌های مشترک و خالص ابزارها (بدون hook؛ در جزیره‌های کلاینت و کامپوننت سرور هر دو قابل استفاده):
 * فهرست مراحل حل، هشدار و خطا، نمایش عدد با رقم فارسی و نماد علمی، و کلید انتخاب دوگزینه‌ای.
 */

/** عدد معمولی با رقم فارسی و «٫» (حداکثر sig رقم بامعنا) */
export function faNumText(x: number, sig = 4): string {
  if (!Number.isFinite(x)) return "—";
  return faDigits(trimNum(Number(x.toPrecision(sig)), 10));
}

/**
 * عدد با رقم فارسی؛ بیرون از بازه‌ی ۰٫۰۰۱ تا ۱۰۰۰۰۰ به‌صورت نماد علمی «۳٫۰۱ × ۱۰²³» (چپ‌به‌راست جدا شده).
 * fixed: تعداد رقم اعشار ثابت برای عددهای معمولی (مثلاً pH با دو رقم اعشار).
 */
export function Num({ value, sig = 4, fixed, className }: { value: number; sig?: number; fixed?: number; className?: string }) {
  if (!Number.isFinite(value)) return <span className={className}>—</span>;
  const a = Math.abs(value);
  if (value === 0 || (a >= 1e-3 && a < 1e5)) {
    const s = fixed !== undefined ? value.toFixed(fixed) : trimNum(Number(value.toPrecision(sig)), 10);
    return <span className={className}>{faDigits(s)}</span>;
  }
  const { mantissa, exponent } = sciParts(value, Math.min(sig, 3));
  return (
    <bdi dir="ltr" className={cn("whitespace-nowrap", className)}>
      {faDigits(mantissa.includes(".") ? mantissa.replace(/\.?0+$/, "") : mantissa)} × ۱۰<sup>{exponent < 0 ? "−" : ""}{faDigits(Math.abs(exponent))}</sup>
    </bdi>
  );
}

/** فهرست مرحله‌های حل: عنوان، توضیح فارسی (ChemText) و سطرهای محاسبه‌ی چپ‌به‌راست */
export function StepList({ steps, className }: { steps: ChemStep[]; className?: string }) {
  if (!steps.length) return null;
  return (
    <ol className={cn("space-y-3", className)}>
      {steps.map((s, i) => (
        <li key={i} className="rounded-2xl border border-white/10 bg-white/[.03] p-4 print:break-inside-avoid">
          <p className="flex items-center gap-2 text-sm font-black">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan/15 text-xs text-cyan">
              {faDigits(i + 1)}
            </span>
            {s.title}
          </p>
          {s.text && (
            <p className="mt-2 text-sm leading-8 text-white/75">
              <ChemText text={s.text} />
            </p>
          )}
          {s.math && s.math.length > 0 && (
            <div dir="ltr" className="mt-2 overflow-x-auto rounded-xl bg-white/5 px-3 py-2 text-left text-[13px] leading-7 text-white/85">
              {s.math.map((m, j) => (
                <div key={j}>
                  <ChemText text={m} />
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** هشدارهای کتابخانه (نحو ChemText) */
export function Warnings({ items, className }: { items: string[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((w, i) => (
        <li key={i} className="flex gap-2 rounded-2xl border border-amber/30 bg-amber/10 px-3 py-2.5 text-sm leading-7 text-white/80">
          <AlertTriangle aria-hidden className="mt-1.5 size-4 shrink-0 text-amber" />
          <span>
            <ChemText text={w} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** کادر خطای ورودی (role=alert تا صفحه‌خوان اعلام کند) */
export function ErrorBox({ error, extra, className }: { error: string; extra?: string[]; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm leading-7", className)}>
      <p className="flex gap-2 font-bold text-white/90">
        <CircleX aria-hidden className="mt-1.5 size-4 shrink-0 text-rose" />
        <span>
          <ChemText text={error} />
        </span>
      </p>
      {extra && extra.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 ps-8 text-white/70">
          {extra.map((w, i) => (
            <li key={i}>
              <ChemText text={w} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * گروه گزینه‌ی رادیویی با ظاهر دکمه‌ای (کلیدهای جهت‌نما و Tab از خود input رادیویی می‌آیند).
 * name باید در صفحه یکتا باشد.
 */
export function Choice<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  className,
}: {
  name: string;
  legend: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan/60",
              value === o.value ? "border-cyan/50 bg-cyan/15 text-white" : "border-white/10 bg-white/[.03] text-white/65 hover:bg-white/[.07]",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
