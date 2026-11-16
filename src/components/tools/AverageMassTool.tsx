"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { faDigits, trimNum } from "@/lib/chem/common";
import { averageAtomicMass, DEFAULT_ISOTOPES } from "@/lib/chem/molar-mass";
import { ErrorBox, StepList, Warnings } from "./ToolBits";

/**
 * ماشین‌حساب کوچک جرم اتمی میانگین (میانگین وزنی جرم ایزوتوپ‌ها با درصد فراوانی).
 * نمونه‌ی پیش‌فرض: کلر-۳۵ (۷۵٪) و کلر-۳۷ (۲۵٪) → ۳۵٫۵ که در HTML سرور هم هست.
 */

interface Row {
  key: number;
  mass: string;
  abundance: string;
}

const MAX_ROWS = 6;

export function AverageMassTool() {
  const id = useId();
  const [rows, setRows] = useState<Row[]>(() => DEFAULT_ISOTOPES.map((r, i) => ({ key: i, mass: String(r.mass), abundance: String(r.abundance) })));
  const [nextKey, setNextKey] = useState(DEFAULT_ISOTOPES.length);
  const result = useMemo(() => averageAtomicMass(rows.map((r) => ({ mass: r.mass, abundance: r.abundance }))), [rows]);

  const update = (key: number, field: "mass" | "abundance", v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: v } : r)));

  return (
    <div className="card my-6 p-5 sm:p-6 print:hidden">
      <h3 id={`${id}-h`} className="mb-4 text-lg font-black">
        ماشین‌حساب جرم اتمی میانگین
      </h3>
      <div role="group" aria-labelledby={`${id}-h`} className="space-y-2">
        <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 text-xs font-semibold text-white/55">
          <span>جرم ایزوتوپ</span>
          <span>درصد فراوانی</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2">
            <input
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              aria-label={`جرم ایزوتوپ ${faDigits(i + 1)}`}
              value={r.mass}
              onChange={(e) => update(r.key, "mass", e.target.value)}
              className="input text-left"
            />
            <input
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              aria-label={`درصد فراوانی ایزوتوپ ${faDigits(i + 1)}`}
              value={r.abundance}
              onChange={(e) => update(r.key, "abundance", e.target.value)}
              className="input text-left"
            />
            <button
              type="button"
              disabled={rows.length <= 1}
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              className="grid place-items-center rounded-2xl text-white/45 hover:bg-white/10 hover:text-rose disabled:opacity-30"
              aria-label={`حذف ایزوتوپ ${faDigits(i + 1)}`}
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= MAX_ROWS}
        onClick={() => {
          setRows((rs) => [...rs, { key: nextKey, mass: "", abundance: "" }]);
          setNextKey((k) => k + 1);
        }}
        className="btn-ghost btn-sm mt-3"
      >
        <Plus aria-hidden className="size-4" /> افزودن ایزوتوپ
      </button>

      <div className="mt-5">
        {!result.ok ? (
          <ErrorBox error={result.error} />
        ) : (
          <>
            <p aria-live="polite" className="rounded-2xl border border-cyan/25 bg-cyan/[.07] px-4 py-3 text-sm text-white/70">
              جرم اتمی میانگین: <strong className="text-2xl font-black text-white">{faDigits(trimNum(result.average, 4))}</strong>
            </p>
            <Warnings items={result.warnings} className="mt-3" />
            <StepList steps={result.steps} className="mt-3" />
          </>
        )}
      </div>
    </div>
  );
}
