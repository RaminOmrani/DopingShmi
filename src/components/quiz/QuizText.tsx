import type { ReactNode } from "react";
import { ChemText } from "@/components/seo/Chem";
import { faNum } from "@/lib/utils";

/**
 * متن سؤال‌ها و پاسخ‌های آزمون: [[…]] محاسبه‌ی چپ‌به‌راست با رقم فارسی، بقیه با ChemText ({{فرمول}} و **پررنگ**).
 * خالص و بدون hook است؛ در کامپوننت سرور و کلاینت هر دو قابل استفاده است.
 */

const MATH_RE = /\[\[([\s\S]+?)\]\]/;
/** توان: ^{…} یا ^ و عدد (با علامت اختیاری) */
const POW_RE = /\^(?:\{([^}]*)\}|([-−+]?[0-9۰-۹]+))/g;

/** رقم لاتین → فارسی، ممیز لاتین بین دو رقم → «٫»، خط تیره → منفی، * → × */
const fmtMath = (s: string) => faNum(s.replace(/(\d)\.(\d)/g, "$1٫$2")).replace(/-/g, "−").replace(/\*/g, "×");

/** تکه‌ی ریاضی → گره‌ها (توان‌ها بالانویس) */
function mathNodes(m: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  POW_RE.lastIndex = 0;
  for (let x = POW_RE.exec(m); x; x = POW_RE.exec(m)) {
    if (x.index > last) out.push(fmtMath(m.slice(last, x.index)));
    out.push(<sup key={k++}>{fmtMath(x[1] ?? x[2])}</sup>);
    last = x.index + x[0].length;
  }
  if (last < m.length) out.push(fmtMath(m.slice(last)));
  return out;
}

/** محاسبه‌ی درون‌خطی، جدا شده به‌صورت چپ‌به‌راست: <MathText m="۹ ÷ ۱۸ = ۰٫۵" /> */
export function MathText({ m }: { m: string }) {
  return (
    <bdi dir="ltr" className="math">
      {mathNodes(m.trim())}
    </bdi>
  );
}

/** متن کامل یک سؤال/گزینه/پاسخ */
export function QuizText({ text }: { text: string }) {
  const parts = text.split(new RegExp(MATH_RE.source, "g"));
  return <>{parts.map((p, i) => (i % 2 ? <MathText key={i} m={p} /> : p ? <ChemText key={i} text={p} /> : null))}</>;
}
