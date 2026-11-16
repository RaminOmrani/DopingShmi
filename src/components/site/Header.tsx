"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/Theme";
import type { NavItem } from "./nav";
import { useMe, type Me } from "./me";

/** بعد از کلیک روی لینک منوی کشویی، فوکوس برداشته شود تا منو (که با focus-within باز است) در صفحه‌ی بعد باز نماند */
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur?.();

/** دکمه‌ی ورود یا پنل؛ وضعیت ورود در مرورگر از /api/me خوانده می‌شود (صفحه‌ی سرور برای همه یکسان و ایستاست) */
function AccountButton({ me }: { me: Me | undefined }) {
  const cls = "btn-primary btn-sm !px-4 sm:min-w-[8.25rem]";
  return me ? (
    <Link href={me.admin ? "/admin" : "/panel"} className={cls}>
      <LayoutDashboard className="size-4" /> {me.admin ? "پنل مدیریت" : "پنل من"}
    </Link>
  ) : (
    <Link href="/login" rel="nofollow" className={cls}>
      <LogIn className="size-4" /> ورود / ثبت‌نام
    </Link>
  );
}

/**
 * هدر سایت. منو روی سرور از SEO_ROUTES ساخته می‌شود (components/site/nav.ts؛ فقط صفحه‌های live).
 * منوهای کشویی و منوی موبایل فقط با CSS (بدون کتابخانه‌ی motion) باز و بسته می‌شوند.
 */
export function Header({ nav }: { nav: NavItem[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const me = useMe();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const close = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 print:hidden">
      <nav aria-label="منوی اصلی" className={`mx-auto flex max-w-7xl items-center justify-between rounded-3xl px-4 py-2.5 transition-all duration-500 ${scrolled ? "glass !bg-ink/75 shadow-2xl shadow-black/40" : "bg-transparent"}`}>
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={36} height={36} className="size-9" />
          <div className="leading-tight">
            <p className="text-base font-black">دوپینگ شیمی</p>
            <p className="text-[10px] font-semibold text-white/50">استاد جواد پرتویی</p>
          </div>
        </Link>
        <ul className="hidden items-center gap-0.5 xl:flex">
          {nav.map((it) =>
            "href" in it ? (
              <li key={it.href}>
                <Link href={it.href} className="block rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white">
                  {it.label}
                </Link>
              </li>
            ) : (
              <li key={it.label} className="group relative">
                <button type="button" aria-haspopup="true" className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white group-focus-within:text-white">
                  {it.label}
                  <ChevronDown aria-hidden className="size-3.5 transition group-hover:rotate-180 group-focus-within:rotate-180" />
                </button>
                <div className="invisible absolute right-0 top-full pt-2 opacity-0 transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <div className="glass grid gap-x-4 gap-y-2 rounded-2xl !bg-ink/90 p-3 shadow-2xl shadow-black/50" style={{ gridTemplateColumns: `repeat(${it.groups.length}, minmax(11rem, max-content))` }}>
                    {it.groups.map((g, i) => (
                      <div key={g.title?.href ?? i}>
                        {g.title && (
                          <Link href={g.title.href} onClick={blurActive} className="block rounded-xl px-3 py-2 text-sm font-black hover:bg-white/5 hover:text-cyan">
                            {g.title.label}
                          </Link>
                        )}
                        {g.links.length > 0 && (
                          <ul>
                            {g.links.map((l) => (
                              <li key={l.href}>
                                <Link href={l.href} onClick={blurActive} className="block whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white">
                                  {l.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountButton me={me} />
          <button className="btn-ghost btn-sm !p-2 xl:hidden" onClick={() => setOpen(true)} aria-label="منو" aria-expanded={open} aria-controls="site-menu">
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      {/* منوی موبایل: همیشه در HTML (لینک‌ها قابل خزش‌اند)، بسته = inert و نامرئی؛ باز و بسته شدن با transition */}
      <div
        id="site-menu"
        inert={!open}
        onClick={close}
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-md transition-[opacity,visibility] duration-300 xl:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="منو"
          onClick={(e) => e.stopPropagation()}
          className={`glass absolute inset-x-3 top-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl p-5 transition duration-300 ${open ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-black text-gradient">دوپینگ شیمی</span>
            <button className="btn-ghost btn-sm !p-2" onClick={close} aria-label="بستن">
              <X className="size-5" />
            </button>
          </div>
          <div className="grid gap-1">
            {nav.map((it) =>
              "href" in it ? (
                <Link key={it.href} href={it.href} onClick={close} className="rounded-2xl px-4 py-3 font-bold text-white/80 hover:bg-white/5">
                  {it.label}
                </Link>
              ) : (
                <div key={it.label} className="rounded-2xl bg-white/[.03] px-2 py-2">
                  <p className="px-2 pb-1 text-xs font-bold text-white/45">{it.label}</p>
                  <div className={it.groups.some((g) => g.links.length) ? "grid gap-1" : "grid grid-cols-3 gap-1"}>
                    {it.groups.map((g, i) => (
                      <div key={g.title?.href ?? i}>
                        {g.title && (
                          <Link href={g.title.href} onClick={close} className={`block rounded-xl px-2 py-2 font-bold text-white/85 hover:bg-white/5 ${g.links.length ? "text-right" : "text-center"}`}>
                            {g.title.label}
                          </Link>
                        )}
                        {g.links.length > 0 && (
                          <ul className="grid gap-0.5 pb-1 pr-2">
                            {g.links.map((l) => (
                              <li key={l.href}>
                                <Link href={l.href} onClick={close} className="block rounded-xl px-2 py-1.5 text-sm text-white/65 hover:bg-white/5 hover:text-white">
                                  {l.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
