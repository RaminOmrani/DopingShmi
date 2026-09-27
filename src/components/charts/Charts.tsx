"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ReferenceLine,
} from "recharts";

import { useTheme } from "@/components/Theme";

/** پالت‌های اعتبارسنجی‌شده (کوررنگی + کنتراست) برای سطح تیره (#0b1026) و روشن (#ffffff) */
const PALETTE = {
  dark: { you: "#0891b2", group: "#a855f7", axis: "rgba(255,255,255,.4)", grid: "rgba(255,255,255,.06)", ref: "rgba(255,255,255,.2)", hover: "rgba(255,255,255,.05)", surface: "#0b1026", track: "rgba(255,255,255,.08)" },
  light: { you: "#0891b2", group: "#9333ea", axis: "rgba(15,23,42,.55)", grid: "rgba(15,23,42,.08)", ref: "rgba(15,23,42,.25)", hover: "rgba(15,23,42,.05)", surface: "#ffffff", track: "rgba(15,23,42,.08)" },
};
export const SERIES = PALETTE.dark;
function usePalette() {
  const p = PALETTE[useTheme()];
  return { ...p, AXIS: { fill: p.axis, fontSize: 11, fontFamily: "inherit" } };
}
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v: unknown) => String(v).replace(/\d/g, (d) => FA[Number(d)]);

function Tip({ active, payload, label, unit = "" }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="mb-1 font-bold text-white/85">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-white/70">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="text-white">{p.value === null || p.value === undefined ? "—" : fa(Math.round(p.value * 10) / 10)}{unit}</b>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-white/65">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "4 3" : undefined} /></svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** روند درصد آزمون‌ها: شما در برابر میانگین گروه */
export function ExamTrend({ data, height = 260 }: { data: { name: string; you: number | null; group: number | null }[]; height?: number }) {
  const P = usePalette();
  return (
    <div>
      <div className="mb-3"><Legend items={[{ label: "درصد شما", color: P.you }, { label: "میانگین گروه", color: P.group, dashed: true }]} /></div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={P.grid} vertical={false} />
          <XAxis dataKey="name" reversed tick={P.AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)} />
          <YAxis orientation="right" domain={[(min: number) => Math.min(0, Math.floor(min / 25) * 25), 100]} ticks={data.some((d) => (d.you ?? 0) < 0 || (d.group ?? 0) < 0) ? [-25, 0, 25, 50, 75, 100] : [0, 25, 50, 75, 100]} tick={P.AXIS} tickLine={false} axisLine={false} width={36} tickFormatter={fa} />
          <ReferenceLine y={0} stroke={P.ref} />
          <Tooltip content={<Tip unit="٪" />} cursor={{ stroke: P.ref }} />
          <Line name="میانگین گروه" dataKey="group" stroke={P.group} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, strokeWidth: 2, stroke: P.surface, fill: P.group }} connectNulls />
          <Line name="درصد شما" dataKey="you" stroke={P.you} strokeWidth={2.5} dot={{ r: 5, strokeWidth: 2, stroke: P.surface, fill: P.you }} activeDot={{ r: 7 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** ستون‌های روزانه (تک‌سری) */
export function DailyBars({ data, dataKey, name, unit = "", height = 200, color, interval = 4 }: { data: Record<string, string | number>[]; dataKey: string; name: string; unit?: string; height?: number; color?: "you" | "group"; interval?: number }) {
  const P = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={P.grid} vertical={false} />
        <XAxis dataKey="label" reversed tick={P.AXIS} tickLine={false} axisLine={false} interval={interval} />
        <YAxis orientation="right" tick={P.AXIS} tickLine={false} axisLine={false} width={32} tickFormatter={fa} allowDecimals={false} />
        <Tooltip content={<Tip unit={unit} />} cursor={{ fill: P.hover }} />
        <Bar name={name} dataKey={dataKey} fill={P[color ?? "you"]} radius={[4, 4, 0, 0]} maxBarSize={interval === 0 ? 48 : 18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** میانگین گروه در هر آزمون (مدیر) */
export function ExamAvgBars({ data, height = 260 }: { data: { name: string; avg: number; max: number }[]; height?: number }) {
  const P = usePalette();
  return (
    <div>
      <div className="mb-3"><Legend items={[{ label: "میانگین درصد", color: P.you }, { label: "بیشترین درصد", color: P.group }]} /></div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={P.grid} vertical={false} />
          <XAxis dataKey="name" reversed tick={P.AXIS} tickLine={false} axisLine={false} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 14) + "…" : v)} />
          <YAxis orientation="right" domain={[0, 100]} tick={P.AXIS} tickLine={false} axisLine={false} width={32} tickFormatter={fa} />
          <Tooltip content={<Tip unit="٪" />} cursor={{ fill: P.hover }} />
          <Bar name="میانگین درصد" dataKey="avg" fill={P.you} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar name="بیشترین درصد" dataKey="max" fill={P.group} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** حلقه‌ی پیشرفت */
export function Ring({ value, size = 72, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringg" x1="0" x2="1"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#a855f7" /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--heat-empty)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringg)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
