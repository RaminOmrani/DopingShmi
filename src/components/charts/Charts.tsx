"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ReferenceLine,
} from "recharts";

/** پالت اعتبارسنجی‌شده روی سطح تیره (#0b1026) */
export const SERIES = { you: "#0891b2", group: "#a855f7" };
const AXIS = { stroke: "rgba(255,255,255,.35)", fontSize: 11, fontFamily: "inherit" };
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v: unknown) => String(v).replace(/\d/g, (d) => FA[Number(d)]);

function Tip({ active, payload, label, unit = "" }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b1026]/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
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
  return (
    <div>
      <div className="mb-3"><Legend items={[{ label: "درصد شما", color: SERIES.you }, { label: "میانگین گروه", color: SERIES.group, dashed: true }]} /></div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="name" reversed tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)} />
          <YAxis orientation="right" domain={[(min: number) => Math.min(0, Math.floor(min / 25) * 25), 100]} ticks={data.some((d) => (d.you ?? 0) < 0 || (d.group ?? 0) < 0) ? [-25, 0, 25, 50, 75, 100] : [0, 25, 50, 75, 100]} tick={AXIS} tickLine={false} axisLine={false} width={36} tickFormatter={fa} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,.2)" />
          <Tooltip content={<Tip unit="٪" />} cursor={{ stroke: "rgba(255,255,255,.2)" }} />
          <Line name="میانگین گروه" dataKey="group" stroke={SERIES.group} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, strokeWidth: 2, stroke: "#0b1026", fill: SERIES.group }} connectNulls />
          <Line name="درصد شما" dataKey="you" stroke={SERIES.you} strokeWidth={2.5} dot={{ r: 5, strokeWidth: 2, stroke: "#0b1026", fill: SERIES.you }} activeDot={{ r: 7 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** ستون‌های روزانه (تک‌سری) */
export function DailyBars({ data, dataKey, name, unit = "", height = 200, color = SERIES.you, interval = 4 }: { data: Record<string, string | number>[]; dataKey: string; name: string; unit?: string; height?: number; color?: string; interval?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="label" reversed tick={AXIS} tickLine={false} axisLine={false} interval={interval} />
        <YAxis orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={32} tickFormatter={fa} allowDecimals={false} />
        <Tooltip content={<Tip unit={unit} />} cursor={{ fill: "rgba(255,255,255,.05)" }} />
        <Bar name={name} dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={interval === 0 ? 48 : 18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** میانگین گروه در هر آزمون (مدیر) */
export function ExamAvgBars({ data, height = 260 }: { data: { name: string; avg: number; max: number }[]; height?: number }) {
  return (
    <div>
      <div className="mb-3"><Legend items={[{ label: "میانگین درصد", color: SERIES.you }, { label: "بیشترین درصد", color: SERIES.group }]} /></div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="name" reversed tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 14) + "…" : v)} />
          <YAxis orientation="right" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={32} tickFormatter={fa} />
          <Tooltip content={<Tip unit="٪" />} cursor={{ fill: "rgba(255,255,255,.05)" }} />
          <Bar name="میانگین درصد" dataKey="avg" fill={SERIES.you} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar name="بیشترین درصد" dataKey="max" fill={SERIES.group} radius={[4, 4, 0, 0]} maxBarSize={28} />
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringg)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
