"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type T = { id: number; text: string; kind: "ok" | "err" };
let push: ((t: Omit<T, "id">) => void) | null = null;

export const toast = {
  ok: (text: string) => push?.({ text, kind: "ok" }),
  err: (text: string) => push?.({ text, kind: "err" }),
};

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`glass pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${t.kind === "ok" ? "text-emerald-200" : "text-rose-200"}`}
          >
            {t.kind === "ok" ? <CheckCircle2 className="size-5 text-emerald-400" /> : <AlertTriangle className="size-5 text-rose-400" />}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
