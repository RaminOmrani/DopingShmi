"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";

export interface LbPhoto { id: string; url: string; title?: string | null; caption?: string | null; eventName?: string | null }

export function Lightbox({ photos, index, onChange }: { photos: LbPhoto[]; index: number | null; onChange: (i: number | null) => void }) {
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(null);
      if (e.key === "ArrowLeft") onChange((index + 1) % photos.length);
      if (e.key === "ArrowRight") onChange((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, photos.length, onChange]);
  const p = index !== null ? photos[index] : null;
  return (
    <AnimatePresence>
      {p && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onChange(null)}>
          <button className="btn-ghost btn-sm absolute left-4 top-4 !rounded-full" onClick={() => onChange(null)} aria-label="بستن"><X className="size-5" /></button>
          <button className="btn-ghost absolute right-3 top-1/2 !rounded-full !p-3" onClick={(e) => { e.stopPropagation(); onChange((index! - 1 + photos.length) % photos.length); }} aria-label="قبلی"><ChevronRight /></button>
          <button className="btn-ghost absolute left-3 top-1/2 !rounded-full !p-3" onClick={(e) => { e.stopPropagation(); onChange((index! + 1) % photos.length); }} aria-label="بعدی"><ChevronLeft /></button>
          <motion.figure key={p.id} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 24 }} className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.title ?? ""} className="max-h-[80dvh] w-auto rounded-2xl object-contain shadow-2xl" />
            {(p.title || p.eventName || p.caption) && (
              <figcaption className="mt-4 text-center">
                {p.eventName && <span className="chip mb-2">{p.eventName}</span>}
                {p.title && <p className="font-bold">{p.title}</p>}
                {p.caption && <p className="text-sm text-white/60">{p.caption}</p>}
              </figcaption>
            )}
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
