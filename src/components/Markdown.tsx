import Link from "next/link";
import type { ReactNode } from "react";

/**
 * نمایش امن متن مقاله با قالب‌بندی سبک (بدون HTML خام):
 *   ## تیتر   ### زیرتیتر   - فهرست   1. فهرست شماره‌دار   > نقل‌قول
 *   **پررنگ**   [متن لینک](آدرس)   ![توضیح عکس](آدرس عکس)
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) out.push(<strong key={`${key}-b${i++}`} className="font-black text-white">{m[2]}</strong>);
    else if (m[4] && m[5]) {
      const href = m[5];
      const safe = /^(https?:\/\/|\/)/.test(href) ? href : "#";
      out.push(
        safe.startsWith("/") ? (
          <Link key={`${key}-l${i++}`} href={safe} className="font-bold text-cyan underline-offset-4 hover:underline">{m[4]}</Link>
        ) : (
          <a key={`${key}-l${i++}`} href={safe} target="_blank" rel="noopener nofollow" className="font-bold text-cyan underline-offset-4 hover:underline">{m[4]}</a>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-5 text-[17px] leading-9 text-white/80">
      {blocks.map((raw, bi) => {
        const b = raw.trim();
        if (!b) return null;
        const k = `b${bi}`;
        if (b.startsWith("### ")) return <h3 key={k} className="pt-2 text-xl font-black text-white">{inline(b.slice(4), k)}</h3>;
        if (b.startsWith("## ")) return <h2 key={k} className="pt-4 text-2xl font-black text-white">{inline(b.slice(3), k)}</h2>;
        const img = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        if (img && /^(https?:\/\/|\/)/.test(img[2]))
          return (
            <figure key={k} className="overflow-hidden rounded-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img[2]} alt={img[1]} loading="lazy" className="w-full" />
              {img[1] && <figcaption className="px-4 py-2 text-center text-sm text-white/50">{img[1]}</figcaption>}
            </figure>
          );
        const lines = b.split("\n");
        if (lines.every((l) => /^[-•]\s/.test(l.trim())))
          return <ul key={k} className="list-disc space-y-2 pr-6 marker:text-cyan">{lines.map((l, i) => <li key={i}>{inline(l.trim().slice(2), `${k}${i}`)}</li>)}</ul>;
        if (lines.every((l) => /^[\d۰-۹]+[.)]\s/.test(l.trim())))
          return <ol key={k} className="list-decimal space-y-2 pr-6 marker:font-bold marker:text-cyan">{lines.map((l, i) => <li key={i}>{inline(l.trim().replace(/^[\d۰-۹]+[.)]\s/, ""), `${k}${i}`)}</li>)}</ol>;
        if (b.startsWith("> "))
          return <blockquote key={k} className="rounded-2xl border-r-4 border-cyan bg-cyan/5 px-5 py-4 text-white/85">{inline(b.replace(/^>\s?/gm, ""), k)}</blockquote>;
        return <p key={k}>{lines.map((l, i) => <span key={i}>{inline(l, `${k}${i}`)}{i < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

/** زمان مطالعه (دقیقه) */
export const readMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 200));
