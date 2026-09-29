"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarClock, BarChart3, PlayCircle, Package, FileCheck2, Images, Medal, FileText, MessageSquareText, Newspaper, CreditCard, Settings, Home, LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/Theme";

const items = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/users", label: "دانش‌آموزان", icon: Users, badge: "pending" },
  { href: "/admin/classes", label: "کلاس‌ها", icon: CalendarClock },
  { href: "/admin/stats", label: "آمار گروهی", icon: BarChart3 },
  { href: "/admin/topics", label: "مباحث و ویدیوها", icon: PlayCircle },
  { href: "/admin/bundles", label: "بسته‌های فروش", icon: Package },
  { href: "/admin/exams", label: "آزمون‌ها", icon: FileCheck2 },
  { href: "/admin/photos", label: "عکس‌ها و همایش‌ها", icon: Images },
  { href: "/admin/ranks", label: "رتبه‌های برتر", icon: Medal },
  { href: "/admin/content", label: "متن‌های سایت و سئو", icon: FileText },
  { href: "/admin/articles", label: "مقالات", icon: Newspaper },
  { href: "/admin/sms", label: "پیامک", icon: MessageSquareText },
  { href: "/admin/payments", label: "پرداخت‌ها", icon: CreditCard, badge: "pay" },
  { href: "/admin/settings", label: "تنظیمات", icon: Settings },
];

const isOn = (p: string, h: string) => (h === "/admin" ? p === "/admin" : p.startsWith(h));

export function AdminNav({ pending, payReview = 0 }: { pending: number; payReview?: number }) {
  const count = (b?: string) => (b === "pending" ? pending : b === "pay" ? payReview : 0);
  const path = usePathname();
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-l border-white/5 p-3 lg:flex">
        <Link href="/admin" className="mb-5 flex items-center gap-2 px-2 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="size-9" />
          <div><p className="font-black">دوپینگ شیمی</p><p className="text-[10px] text-amber">پنل مدیریت</p></div>
        </Link>
        <nav className="grid gap-0.5">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isOn(path, i.href) ? "bg-gradient-to-l from-cyan/15 to-violet/15 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}>
              <i.icon className={`size-[18px] ${isOn(path, i.href) ? "text-cyan" : ""}`} />
              <span className="flex-1">{i.label}</span>
              {count(i.badge) > 0 && <span className="rounded-full bg-amber px-2 text-[11px] font-black text-ink">{count(i.badge)}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-0.5 pt-4">
          <ThemeToggle withLabel className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/55 hover:bg-white/5" />
          <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/55 hover:bg-white/5"><Home className="size-[18px]" /> مشاهده سایت</Link>
          <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/"; }} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-rose/80 hover:bg-white/5"><LogOut className="size-[18px]" /> خروج</button>
        </div>
      </aside>
      <nav className="glass no-scrollbar sticky top-0 z-40 flex gap-1 overflow-x-auto px-2 py-2 lg:hidden">
        <ThemeToggle className="flex shrink-0 items-center rounded-xl px-3 py-2 text-white/55" />
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${isOn(path, i.href) ? "bg-cyan/15 text-white" : "text-white/55"}`}>
            <i.icon className="size-4" /> {i.label}
            {count(i.badge) > 0 && <span className="rounded-full bg-amber px-1.5 text-[10px] font-black text-ink">{count(i.badge)}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}
