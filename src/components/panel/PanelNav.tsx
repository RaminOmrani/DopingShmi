"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlayCircle, FileCheck2, Trophy, UserRound, LogOut, Home, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/Theme";

const items = [
  { href: "/panel", label: "داشبورد", icon: LayoutDashboard },
  { href: "/panel/videos", label: "ویدیوها", icon: PlayCircle },
  { href: "/panel/exams", label: "آزمون‌ها", icon: FileCheck2 },
  { href: "/panel/leaderboard", label: "رتبه‌بندی", icon: Trophy },
  { href: "/panel/profile", label: "پروفایل", icon: UserRound },
];

const active = (path: string, href: string) => (href === "/panel" ? path === "/panel" : path.startsWith(href));

export function SideNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-white/5 p-4 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2 pt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="size-10" />
        <div>
          <p className="font-black">دوپینگ شیمی</p>
          <p className="text-[10px] text-white/45">پنل دانش‌آموز</p>
        </div>
      </Link>
      <nav className="grid gap-1">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${active(path, i.href) ? "bg-gradient-to-l from-cyan/15 to-violet/15 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,.25)]" : "text-white/55 hover:bg-white/5 hover:text-white"}`}>
            <i.icon className={`size-5 ${active(path, i.href) ? "text-cyan" : ""}`} /> {i.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto grid gap-1">
        <ThemeToggle withLabel className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/55 hover:bg-white/5" />
        {admin && <Link href="/admin" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-amber hover:bg-white/5"><ShieldCheck className="size-5" /> پنل مدیریت</Link>}
        <Link href="/" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/55 hover:bg-white/5"><Home className="size-5" /> صفحه اصلی سایت</Link>
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/"; }} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-rose/80 hover:bg-white/5">
          <LogOut className="size-5" /> خروج
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="glass !bg-ink/85 fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-3xl px-1 py-1.5 pb-[max(.375rem,env(safe-area-inset-bottom))] lg:hidden">
      {items.map((i) => {
        const on = active(path, i.href);
        return (
          <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-bold transition ${on ? "text-white" : "text-white/45"}`}>
            <span className={`grid size-9 place-items-center rounded-xl transition ${on ? "bg-gradient-to-br from-cyan/30 to-violet/40 shadow-[0_0_20px_-4px_rgba(34,211,238,.6)]" : ""}`}>
              <i.icon className="size-5" />
            </span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
