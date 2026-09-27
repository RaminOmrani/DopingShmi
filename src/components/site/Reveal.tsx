"use client";
import { motion, useInView, animate } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function Reveal({ children, delay = 0, y = 30, className = "" }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const FA = "۰۱۲۳۴۵۶۷۸۹";
const toFa = (s: string) => s.replace(/\d/g, (d) => FA[Number(d)]);
const toEn = (s: string) => s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));

/** شمارنده: اگر متن فقط عدد (با +) باشد متحرک شمارش می‌کند، در غیر این صورت همان متن را نشان می‌دهد */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const m = toEn(value).match(/^(\+?)(\d+)(\+?)$/);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView || !m) return;
    const c = animate(0, Number(m[2]), { duration: 1.8, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className={className}>
      {m ? toFa(`${m[1]}${n}${m[3]}`) : value}
    </span>
  );
}
