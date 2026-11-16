import { Fragment } from "react";
import { ChemText } from "@/components/seo/Chem";

/**
 * متن راهنمای ابزارها: نحو ChemText ({{فرمول}}، **پررنگ**) به‌اضافه‌ی `…` برای ورودی‌ای که کاربر باید عیناً تایپ کند.
 * تکه‌ی `…` چپ‌به‌راست و بدون زیروند نمایش داده می‌شود (مثل `CuSO4.5H2O`)؛ کلاس chem دارد تا مثل فرمول جدا شده
 * و بررسی‌گر سئو آن را فرمول خام حساب نکند. کامپوننت خالص است (سرور و کلاینت).
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <bdi key={i} dir="ltr" translate="no" className="chem chem-code whitespace-nowrap">
            <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-white/90">{p}</code>
          </bdi>
        ) : (
          <Fragment key={i}>
            <ChemText text={p} />
          </Fragment>
        ),
      )}
    </>
  );
}
