import { levelOf } from "@/lib/constants";
import { faNum } from "@/lib/utils";

/** نشان سطح به شکل خانه‌ی جدول تناوبی */
export function LevelBadge({ points, size = "md" }: { points: number; size?: "sm" | "md" | "lg" }) {
  const l = levelOf(points);
  const dims = size === "lg" ? "size-24 text-4xl" : size === "sm" ? "size-10 text-base" : "size-16 text-2xl";
  return (
    <div className={`relative grid ${dims} shrink-0 place-items-center rounded-2xl border border-cyan/40 bg-gradient-to-br from-cyan/20 via-violet/25 to-magenta/20 font-black shadow-[0_0_30px_-8px_rgba(34,211,238,.6)]`} title={`سطح ${l.level}: ${l.name}`}>
      {size !== "sm" && <span className="absolute right-1.5 top-1 text-[10px] font-bold text-white/60">{faNum(l.level)}</span>}
      <span className="text-white" dir="ltr">{l.symbol}</span>
      {size === "lg" && <span className="absolute bottom-1.5 text-[10px] font-semibold text-white/70">{l.name}</span>}
    </div>
  );
}
