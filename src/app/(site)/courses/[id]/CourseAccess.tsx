"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, PlayCircle, Gift, CheckCircle2, Clock } from "lucide-react";
import { BuyButton } from "@/components/BuyButton";
import { faNum, fmtClock, fmtDate, fmtToman } from "@/lib/utils";

/**
 * بخش‌های وابسته به کاربر صفحه‌ی مبحث/بسته (جزیره‌ی کلاینت): صفحه‌ی سرور ایستا/ISR است و برای همه حالت «مهمان» را
 * می‌سازد؛ اینجا پس از بارگذاری، دسترسی همین کاربر از GET /api/me?topic=… (یا ?bundle=…) خوانده و همان رفتار قبلی
 * نشان داده می‌شود: «این مبحث برای شما باز است»، تاریخ پایان دسترسی، تیک ویدیوهای دیده‌شده و لینک مستقیم پخش.
 */
type Access = { loggedIn: boolean; owned: boolean; expires: string | null; done: string[] };
const GUEST: Access = { loggedIn: false, owned: false, expires: null, done: [] };

function useAccess(query: string): Access {
  const [a, setA] = useState<Access>(GUEST);
  useEffect(() => {
    let live = true;
    fetch(`/api/me?${query}`, { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: unknown; owned?: boolean; expires?: string | null; done?: string[] } | null) => {
        if (live && d?.user) setA({ loggedIn: true, owned: !!d.owned, expires: d.expires ?? null, done: d.done ?? [] });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [query]);
  return a;
}

export interface TopicVideo {
  id: string;
  title: string;
  durationSec: number;
  isFree: boolean;
}

export function TopicAccess({ topicId, price, videos, bundles }: { topicId: string; price: number; videos: TopicVideo[]; bundles: { id: string; title: string }[] }) {
  const a = useAccess(`topic=${encodeURIComponent(topicId)}`);
  const done = new Set(a.done);
  return (
    <>
      <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 p-6">
        {a.owned ? (
          <div className="flex items-center gap-3 text-lime">
            <CheckCircle2 className="size-6" />
            <div>
              <p className="font-black">این مبحث برای شما باز است</p>
              {a.expires && <p className="text-xs text-white/55">دسترسی تا {fmtDate(a.expires)}</p>}
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-white/55">دسترسی کامل به {faNum(videos.length)} ویدیوی این مبحث</p>
              {price > 0 ? <p className="text-2xl font-black text-gradient">{fmtToman(price)}</p> : <p className="text-sm text-white/60">فروش تکی این مبحث فعال نیست؛ بسته‌های جامع را ببینید.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {price > 0 && <BuyButton type="TOPIC" id={topicId} loggedIn={a.loggedIn} />}
              {bundles.map((b) => (
                <Link key={b.id} href={`/courses/bundle-${b.id}`} className="btn-ghost">بسته «{b.title}»</Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3">
        {videos.map((v, i) => {
          const open = v.isFree || a.owned;
          const href = open ? (a.loggedIn ? `/panel/videos/${v.id}` : `/login?next=/panel/videos/${v.id}`) : "#";
          return (
            <Link
              key={v.id}
              href={href}
              rel={open && !a.loggedIn ? "nofollow" : undefined}
              aria-disabled={!open}
              className={`card flex items-center gap-4 p-4 transition ${open ? "hover:border-cyan/40" : "cursor-not-allowed opacity-70"}`}
            >
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${open ? "bg-gradient-to-br from-cyan/25 to-violet/30 text-white" : "bg-white/5 text-white/40"}`}>
                {done.has(v.id) ? <CheckCircle2 className="size-6 text-lime" /> : open ? <PlayCircle className="size-6" /> : <Lock className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{faNum(i + 1)}. {v.title}</p>
                <p className="flex items-center gap-1 text-xs text-white/50"><Clock className="size-3" /> {fmtClock(v.durationSec)}</p>
              </div>
              {v.isFree && <span className="chip !border-lime/30 !bg-lime/10 !text-lime"><Gift className="size-3" /> رایگان</span>}
            </Link>
          );
        })}
        {videos.length === 0 && <div className="card p-10 text-center text-white/50">ویدیوهای این مبحث به‌زودی منتشر می‌شوند.</div>}
      </div>
    </>
  );
}

export function BundleAccess({ bundleId }: { bundleId: string }) {
  const a = useAccess(`bundle=${encodeURIComponent(bundleId)}`);
  return a.owned ? (
    <span className="chip !text-lime"><CheckCircle2 className="size-4" /> در دسترس شما</span>
  ) : (
    <BuyButton type="BUNDLE" id={bundleId} loggedIn={a.loggedIn} />
  );
}
