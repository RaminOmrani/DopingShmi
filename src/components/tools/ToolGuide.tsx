import type { ReactNode } from "react";
import { Eq } from "@/components/seo/Chem";
import { Callout, RouteLink } from "@/components/seo/EduChrome";
import { label as routeLabel } from "@/lib/site-routes";
import { cn, faNum } from "@/lib/utils";
import type { GuideExample, GuideSection } from "@/content/tools/types";
import { RichText } from "./RichText";

/**
 * بدنه‌ی راهنمای آموزشی صفحه‌های ابزار (کامپوننت خالص، بدون hook): بخش‌ها با H2، مثال‌های حل‌شده با H3،
 * کادرهای «اشتباه رایج» و «نکته» و لینک امن به فصل مرتبط (RouteLink؛ تا live نشدن فصل، متن ساده).
 */

function Example({ ex, n }: { ex: GuideExample; n: number }) {
  return (
    <div className="card my-6 p-5 print:break-inside-avoid sm:p-6">
      <h3 className="mb-3 text-lg font-black">
        <span className="text-teal">مثال {faNum(n)}:</span> {ex.title}
      </h3>
      <p className="mb-3 leading-9 text-white/85">
        <RichText text={ex.question} />
      </p>
      <ol className="mb-3 list-[persian] space-y-1.5 ps-6 leading-9 text-white/75 marker:font-bold marker:text-teal">
        {ex.steps.map((s, i) => (
          <li key={i}>
            <RichText text={s} />
          </li>
        ))}
      </ol>
      <p className="rounded-xl bg-teal/10 px-4 py-2.5 leading-9 text-white/90">
        <strong className="text-teal">پاسخ: </strong>
        <RichText text={ex.answer} />
      </p>
    </div>
  );
}

function Section({ sec, exampleStart, slot }: { sec: GuideSection; exampleStart: number; slot?: ReactNode }) {
  return (
    <section id={sec.id} aria-labelledby={`${sec.id}-h`} className="mb-14 scroll-mt-28">
      <h2 id={`${sec.id}-h`} className="mb-5 text-2xl font-black leading-snug md:text-3xl">
        <RichText text={sec.heading} />
      </h2>
      {sec.paragraphs.map((p, i) => (
        <p key={i} className="mb-4 leading-9 text-white/75">
          <RichText text={p} />
        </p>
      ))}
      {sec.equations?.map((e) => (
        <Eq key={e} f={e} className="rounded-xl bg-white/5 px-3 text-base sm:text-lg" />
      ))}
      {sec.ordered && (
        <ol className="mb-4 list-[persian] space-y-2 ps-6 leading-9 text-white/75 marker:font-bold marker:text-cyan">
          {sec.ordered.map((b, i) => (
            <li key={i}>
              <RichText text={b} />
            </li>
          ))}
        </ol>
      )}
      {sec.bullets && (
        <ul className="mb-4 list-disc space-y-2 ps-6 leading-9 text-white/75 marker:text-cyan">
          {sec.bullets.map((b, i) => (
            <li key={i}>
              <RichText text={b} />
            </li>
          ))}
        </ul>
      )}
      {sec.examples?.map((ex, i) => <Example key={i} ex={ex} n={exampleStart + i} />)}
      {slot}
      {sec.tip && (
        <Callout kind="tip">
          <RichText text={sec.tip} />
        </Callout>
      )}
      {sec.mistake && (
        <Callout kind="mistake">
          <RichText text={sec.mistake} />
        </Callout>
      )}
      {sec.see && sec.see.length > 0 && (
        <p className="mt-4 text-sm leading-8 text-white/60 print:hidden">
          مرور کامل این مبحث:{" "}
          {sec.see.map((l, i) => (
            <span key={l.path}>
              {i > 0 && "، "}
              <RouteLink
                path={l.path}
                className="font-bold text-cyan underline-offset-4 hover:underline"
                fallback={<span className="font-bold text-white/70">{l.text ?? routeLabel(l.path) ?? l.path}</span>}
              >
                {l.text ?? routeLabel(l.path) ?? l.path}
              </RouteLink>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

/**
 * همه‌ی بخش‌های راهنما؛ شماره‌ی مثال‌ها در کل صفحه پیوسته است.
 * slots: محتوای اضافه (مثلاً یک جزیره‌ی کوچک ابزار) که پس از مثال‌های بخش با همان id می‌آید.
 */
export function ToolGuide({ sections, slots, className }: { sections: GuideSection[]; slots?: Record<string, ReactNode>; className?: string }) {
  let n = 1;
  return (
    <div className={cn("max-w-3xl", className)}>
      {sections.map((sec) => {
        const start = n;
        n += sec.examples?.length ?? 0;
        return <Section key={sec.id} sec={sec} exampleStart={start} slot={slots?.[sec.id]} />;
      })}
    </div>
  );
}
