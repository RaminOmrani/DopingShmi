"use client";
import { useMemo, useState } from "react";
import { Lightbox, type LbPhoto } from "./Lightbox";

export function GalleryGrid({ photos }: { photos: (LbPhoto & { thumbUrl?: string | null })[] }) {
  const events = useMemo(() => ["همه", ...Array.from(new Set(photos.map((p) => p.eventName).filter(Boolean) as string[]))], [photos]);
  const [ev, setEv] = useState("همه");
  const [open, setOpen] = useState<number | null>(null);
  const list = ev === "همه" ? photos : photos.filter((p) => p.eventName === ev);
  return (
    <>
      {events.length > 2 && (
        <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto">
          {events.map((e) => (
            <button key={e} onClick={() => setEv(e)} className={`btn-sm btn shrink-0 ${ev === e ? "btn-primary" : "btn-ghost"}`}>{e}</button>
          ))}
        </div>
      )}
      <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
        {list.map((p, i) => (
          <button key={p.id} onClick={() => setOpen(i)} className="group relative mb-3 block w-full overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl || p.url} alt={p.title ?? ""} loading="lazy" className="w-full transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition group-hover:opacity-100" />
            {p.title && <p className="absolute inset-x-0 bottom-0 p-3 text-right text-xs font-bold opacity-0 transition group-hover:opacity-100">{p.title}</p>}
          </button>
        ))}
      </div>
      <Lightbox photos={list} index={open} onChange={setOpen} />
    </>
  );
}
