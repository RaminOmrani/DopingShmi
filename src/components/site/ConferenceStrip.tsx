"use client";
import { useState } from "react";
import { Lightbox, type LbPhoto } from "./Lightbox";

const placeholders = ["همایش جمع‌بندی شیمی", "همایش استوکیومتری", "همایش شیمی آلی", "همایش نکته و تست", "همایش ترمودینامیک", "همایش شب امتحان"];

/** نوار سینمایی عکس‌های همایش: دو ردیف با حرکت مخالف، توقف با هاور، بازشدن در لایت‌باکس */
export function ConferenceStrip({ photos }: { photos: (LbPhoto & { thumbUrl?: string | null })[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const has = photos.length > 0;
  const half = Math.ceil(photos.length / 2);
  const rows = has ? (photos.length >= 6 ? [photos.slice(0, half), photos.slice(half)] : [photos]) : [];

  if (!has) {
    return (
      <div className="fade-x flex gap-4 overflow-hidden">
        {placeholders.map((t, i) => (
          <div key={t} className="on-dark card relative grid h-56 w-80 shrink-0 place-items-end overflow-hidden p-5" style={{ background: `linear-gradient(${120 + i * 30}deg, rgba(34,211,238,.18), rgba(139,92,246,.22), rgba(3,4,11,.9))` }}>
            <span className="text-sm font-bold text-white/80">{t}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row, ri) => {
        const loop = [...row, ...row, ...(row.length < 5 ? [...row, ...row] : [])];
        return (
          <div key={ri} className="fade-x group overflow-hidden" dir="ltr">
            <div
              className="flex w-max gap-4 animate-marquee group-hover:[animation-play-state:paused]"
              style={{ ["--marquee-duration" as string]: `${Math.max(30, row.length * 9)}s`, animationDirection: ri % 2 ? "reverse" : "normal" }}
            >
              {loop.map((p, i) => (
                <button
                  key={`${p.id}-${i}`}
                  onClick={() => setOpen(photos.indexOf(p))}
                  className="on-dark relative h-52 w-72 shrink-0 overflow-hidden rounded-3xl border border-white/10 md:h-64 md:w-96"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl || p.url} alt={p.title ?? "همایش"} loading="lazy" className="h-full w-full object-cover transition duration-700 hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-right" dir="rtl">
                    {p.eventName && <p className="text-[11px] font-bold text-cyan">{p.eventName}</p>}
                    {p.title && <p className="line-clamp-1 text-sm font-bold">{p.title}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <Lightbox photos={photos} index={open} onChange={setOpen} />
    </div>
  );
}
