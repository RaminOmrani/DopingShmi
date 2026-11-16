"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type T = { id: number; text: string; kind: "ok" | "err"; leaving?: boolean };
let push: ((t: Omit<T, "id">) => void) | null = null;

export const toast = {
  ok: (text: string) => push?.({ text, kind: "ok" }),
  err: (text: string) => push?.({ text, kind: "err" }),
};

const SHOW_MS = 4200;
const LEAVE_MS = 200;

/** اعلان‌ها؛ ورود و خروج با CSS (بدون کتابخانه‌ی motion تا روی همه‌ی صفحه‌ها بار نشود) */
export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.map((i) => (i.id === id ? { ...i, leaving: true } : i))), SHOW_MS - LEAVE_MS);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), SHOW_MS);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`glass pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl transition duration-200 ${t.leaving ? "-translate-y-2 scale-95 opacity-0" : "animate-drop-in"} ${t.kind === "ok" ? "text-emerald-200" : "text-rose-200"}`}
        >
          {t.kind === "ok" ? <CheckCircle2 className="size-5 text-emerald-400" /> : <AlertTriangle className="size-5 text-rose-400" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
