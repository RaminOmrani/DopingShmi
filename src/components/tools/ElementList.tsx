"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { faDigits, trimNum } from "@/lib/chem/common";
import { ELEMENTS, type ChemElement } from "@/lib/chem/elements";
import { cn } from "@/lib/utils";

/**
 * فهرست «نام عناصر جدول تناوبی به فارسی» با مرتب‌سازی ستون‌ها (عدد اتمی، نماد، نام فارسی، نام انگلیسی، جرم).
 * HTML سرور همه‌ی ۱۱۸ سطر را به ترتیب عدد اتمی دارد؛ مرتب‌سازی فقط در مرورگر است. در چاپ جدول خالی پنهان می‌شود.
 */

type Key = "z" | "symbol" | "fa" | "en" | "mass";

const COLS: { key: Key; label: string }[] = [
  { key: "z", label: "عدد اتمی" },
  { key: "symbol", label: "نماد" },
  { key: "fa", label: "نام فارسی" },
  { key: "en", label: "نام انگلیسی" },
  { key: "mass", label: "جرم اتمی" },
];

const faCollator = new Intl.Collator("fa");
const enCollator = new Intl.Collator("en");

function compare(a: ChemElement, b: ChemElement, key: Key): number {
  switch (key) {
    case "z":
      return a.z - b.z;
    case "mass":
      return a.mass - b.mass || a.z - b.z;
    case "fa":
      return faCollator.compare(a.fa, b.fa);
    case "symbol":
      return enCollator.compare(a.symbol, b.symbol);
    case "en":
      return enCollator.compare(a.en, b.en);
  }
}

export function ElementList() {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "z", dir: 1 });
  const rows = useMemo(() => [...ELEMENTS].sort((a, b) => compare(a, b, sort.key) * sort.dir), [sort]);

  const toggle = (key: Key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <div className="table-wrap print:overflow-visible print:border-0">
      <table className="table print:text-[8px] print:[&_td]:py-0.5 print:[&_th]:py-1">
        <caption className="sr-only">نام فارسی و انگلیسی، نماد و جرم اتمی ۱۱۸ عنصر؛ با دکمه‌ی سر هر ستون مرتب می‌شود.</caption>
        <thead>
          <tr>
            {COLS.map((c) => {
              const active = sort.key === c.key;
              const Icon = active ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 hover:text-white", active && "text-cyan")}>
                    {c.label}
                    <Icon aria-hidden className="size-3 print:hidden" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.z}>
              <td>{faDigits(e.z)}</td>
              <td className="font-bold">
                <bdi dir="ltr">{e.symbol}</bdi>
              </td>
              <td className="font-bold">{e.fa}</td>
              <td>
                <bdi dir="ltr">{e.en}</bdi>
              </td>
              <td className="whitespace-nowrap">{faDigits(e.massNumberOnly ? e.massText : trimNum(e.mass, 4))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
