"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, LayoutDashboard, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/Theme";

const links = [
  { href: "/#about", label: "درباره استاد" },
  { href: "/#conferences", label: "همایش‌ها" },
  { href: "/#ranks", label: "رتبه‌ها" },
  { href: "/courses", label: "ویدیوها" },
  { href: "/gallery", label: "گالری" },
  { href: "/#contact", label: "تماس" },
];

export function Header({ user }: { user: { name: string; admin: boolean } | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const panelHref = user?.admin ? "/admin" : "/panel";
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav className={`mx-auto flex max-w-7xl items-center justify-between rounded-3xl px-4 py-2.5 transition-all duration-500 ${scrolled ? "glass !bg-ink/75 shadow-2xl shadow-black/40" : "bg-transparent"}`}>
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="size-9" />
          <div className="leading-tight">
            <p className="text-base font-black">دوپینگ شیمی</p>
            <p className="text-[10px] font-semibold text-white/50">استاد جواد پرتویی</p>
          </div>
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link href={panelHref} className="btn-primary btn-sm !px-4">
              <LayoutDashboard className="size-4" /> {user.admin ? "پنل مدیریت" : "پنل من"}
            </Link>
          ) : (
            <Link href="/login" className="btn-primary btn-sm !px-4">
              <LogIn className="size-4" /> ورود / ثبت‌نام
            </Link>
          )}
          <button className="btn-ghost btn-sm !p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="منو">
            <Menu className="size-5" />
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div
              className="glass absolute inset-x-3 top-3 rounded-3xl p-5"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-black text-gradient">دوپینگ شیمی</span>
                <button className="btn-ghost btn-sm !p-2" onClick={() => setOpen(false)} aria-label="بستن"><X className="size-5" /></button>
              </div>
              <div className="grid gap-1">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-bold text-white/80 hover:bg-white/5">
                    {l.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
