import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { groupEq, splitChemText, tokenizeChem, type ChemSegment, type ChemToken } from "./chem-format";

/**
 * نمایش فرمول و معادله‌ی شیمیایی داخل متن فارسی، جدا شده به‌صورت چپ‌به‌راست (bdi) تا ترتیب نویسه‌ها به هم نریزد.
 * کامپوننت خالص است (بدون hook)؛ در کامپوننت سرور و کلاینت هر دو قابل استفاده است.
 * قواعد نوشتن فرمول در chem-format.ts آمده است.
 */
export { chemPlain, chemTextPlain, hasArrow, splitChemText, tokenizeChem, tokensToPlain, groupEq } from "./chem-format";
export type { ChemSegment, ChemToken, EqPart } from "./chem-format";

function renderToken(tok: ChemToken, key: number): ReactNode {
  switch (tok.t) {
    case "sub":
      return <sub key={key}>{tok.v}</sub>;
    case "sup":
      return <sup key={key}>{tok.v}</sup>;
    case "dot":
      return <span key={key} className="mx-px">·</span>;
    case "state":
      return <span key={key} className="chem-state text-[0.85em]">{tok.v}</span>;
    case "e":
      return "e";
    case "space":
      return " ";
    case "plus":
      return " + ";
    case "arrow":
      return <span key={key} className="chem-arrow mx-1">{tok.v}</span>;
    default:
      return tok.v;
  }
}

/** رشته‌های پشت‌سرهم یکی می‌شوند تا SSR بین آن‌ها کامنت <!-- --> نگذارد (S<!-- -->O) */
function renderTokens(tokens: ChemToken[]): ReactNode[] {
  const out: ReactNode[] = [];
  tokens.forEach((tok, i) => {
    const node = renderToken(tok, i);
    if (typeof node === "string" && typeof out[out.length - 1] === "string") out[out.length - 1] += node;
    else out.push(node);
  });
  return out;
}

/** فرمول یک گونه، مثل <Chem f="H2SO4" /> یا <Chem f="SO4^2-" /> */
export function Chem({ f, className }: { f: string; className?: string }) {
  return (
    <bdi dir="ltr" translate="no" className={cn("chem whitespace-nowrap", className)}>
      {renderTokens(tokenizeChem(f))}
    </bdi>
  );
}

/**
 * معادله‌ی واکنش: <Eq f="2H2(g) + O2(g) -> 2H2O(l)" />؛ «->» پیکان یک‌طرفه و «<=>» پیکان تعادلی می‌شود.
 * block (پیش‌فرض true): سطر جدا و وسط‌چین؛ false: درون‌خطی. هر گونه نمی‌شکند ولی خط کنار «+» و پیکان می‌شکند.
 * خروجی همیشه محتوای درون‌خطی (bdi/span) است و داخل <p> هم معتبر است.
 */
export function Eq({ f, block = true, className }: { f: string; block?: boolean; className?: string }) {
  const parts = groupEq(tokenizeChem(f));
  return (
    <bdi
      dir="ltr"
      translate="no"
      className={cn("chem chem-eq max-w-full", block ? "my-3 block text-center leading-9 print:break-inside-avoid" : "inline", className)}
    >
      {parts.map((p, i) =>
        p.kind === "species" ? (
          <span key={i} className="whitespace-nowrap">{renderTokens(p.tokens)}</span>
        ) : p.token.t === "arrow" ? (
          <span key={i} className="chem-arrow"> {p.token.v} </span>
        ) : (
          <span key={i} className="chem-op"> + </span>
        ),
      )}
    </bdi>
  );
}

function renderSegments(segs: ChemSegment[], eqBlock: boolean): ReactNode[] {
  return segs.map((s, i) => {
    switch (s.t) {
      case "text":
        return s.v;
      case "chem":
        return <Chem key={i} f={s.v} />;
      case "eq":
        return <Eq key={i} f={s.v} block={eqBlock} />;
      case "bold":
        return <strong key={i}>{renderSegments(s.children, eqBlock)}</strong>;
    }
  });
}

/**
 * متن فارسی با فرمول: «اسید {{H2SO4}} دوپروتونی است» و «**پررنگ**».
 * {{…}} با پیکان به‌صورت Eq درون‌خطی نمایش داده می‌شود (eqBlock برای سطر جدا).
 */
export function ChemText({ text, eqBlock = false }: { text: string; eqBlock?: boolean }) {
  return <>{renderSegments(splitChemText(text), eqBlock)}</>;
}
