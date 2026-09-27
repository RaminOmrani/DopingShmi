"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "dark" | "light";
const KEY = "ds-theme";

/** اسکریپت پیش از رندر: جلوگیری از چشمک زدن رنگ (پیش‌فرض: تیره) */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"){document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#f5f7fc")}}catch(e){}`;

const current = (): Theme => (typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function useTheme(): Theme {
  const [t, setT] = useState<Theme>("dark");
  useEffect(() => {
    setT(current());
    const mo = new MutationObserver(() => setT(current()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return t;
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", t === "light" ? "#f5f7fc" : "#03040b"));
  try {
    localStorage.setItem(KEY, t);
  } catch {}
}

export function ThemeToggle({ className = "", withLabel = false }: { className?: string; withLabel?: boolean }) {
  const t = useTheme();
  const next: Theme = t === "light" ? "dark" : "light";
  return (
    <button type="button" onClick={() => setTheme(next)} className={className || "btn-ghost btn-sm !p-2"} aria-label={t === "light" ? "حالت تیره" : "حالت روشن"} title={t === "light" ? "حالت تیره" : "حالت روشن"}>
      {t === "light" ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
      {withLabel && <span>{t === "light" ? "حالت تیره" : "حالت روشن"}</span>}
    </button>
  );
}
