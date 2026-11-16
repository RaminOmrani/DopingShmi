import type { ReactNode } from "react";
import Link from "next/link";
import { toJalaali } from "jalaali-js";
import { AlertTriangle, Calculator, ChevronLeft, GraduationCap, Lightbulb, Phone, Target } from "lucide-react";
import type { SiteContent } from "@/lib/settings";
import { EDITORIAL_PATH, TEACHER_CREDENTIAL, isLive, label as routeLabel, route, type Crumb } from "@/lib/site-routes";
import { cn, faNum } from "@/lib/utils";

/**
 * قطعه‌های مشترک صفحه‌های آموزشی (قرارداد سئو): مسیر راهنما، امضای نویسنده، لینک امن، لینک‌های مرتبط،
 * کادرهای نکته و دعوت ملایم به کلاس. همه بدون hook و بدون وابستگی سروری‌اند (در سرور و کلاینت قابل استفاده).
 */
export type { Crumb };

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

/** «2026-11-16» → «۲۵ آبان ۱۴۰۵» */
export function jalaliLong(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return "";
  const { jy, jm, jd } = toJalaali(+m[1], +m[2], +m[3]);
  return `${faNum(jd)} ${MONTHS[jm - 1]} ${faNum(jy)}`;
}

/** مسیر راهنمای دیدنی؛ همان آرایه را به eduGraph({ breadcrumb }) بدهید تا BreadcrumbList یکی باشد (مثلاً crumbsFor(path)) */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="مسیر صفحه" className={cn("mb-6 text-xs text-white/45 print:hidden", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.path} className="flex items-center gap-1.5">
              {i > 0 && <ChevronLeft aria-hidden className="size-3 text-white/30" />}
              {last ? (
                <span aria-current="page" className="text-white/70">{it.name}</span>
              ) : isLive(it.path) ? (
                <Link href={it.path} className="hover:text-cyan">{it.name}</Link>
              ) : (
                <span>{it.name}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * امضای صفحه: تا وقتی teacherReviewed این مسیر در SEO_ROUTES false است، نویسنده سازمان «دوپینگ شیمی» است؛
 * پس از خواندن استاد: «نوشته و بازبینی علمی: استاد …». تاریخ به‌روزرسانی از updated همان مسیر (شمسی).
 */
export function Byline({ s, path, className }: { s: SiteContent; path: string; className?: string }) {
  const r = route(path);
  const reviewed = r?.teacherReviewed ?? false;
  const teacherLink = (
    <Link href="/javad-partovi" className="font-bold text-white/80 hover:text-cyan">استاد {s.teacherName}</Link>
  );
  return (
    <div className={cn("mb-8 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs leading-6 text-white/55", className)}>
      {reviewed ? (
        <span>
          نوشته و بازبینی علمی: {teacherLink} <span className="text-white/45">({TEACHER_CREDENTIAL})</span>
        </span>
      ) : (
        <span>
          نویسنده: <Link href="/" className="font-bold text-white/80 hover:text-cyan">{s.brand}</Link>، مجموعه‌ی آموزشی {teacherLink}
        </span>
      )}
      {r?.updated && (
        <span>
          به‌روزرسانی: <time dateTime={r.updated}>{jalaliLong(r.updated)}</time>
        </span>
      )}
      <Link href={EDITORIAL_PATH} className="underline decoration-white/20 underline-offset-4 hover:text-cyan print:hidden">روش تهیه و بازبینی محتوا</Link>
    </div>
  );
}

export interface RouteLinkProps {
  path: string;
  children: ReactNode;
  className?: string;
  /** وقتی صفحه live نیست؛ پیش‌فرض: همان متن در <span>. برای پنهان کردن کامل: fallback={null} */
  fallback?: ReactNode;
  prefetch?: boolean;
  title?: string;
  "aria-label"?: string;
  id?: string;
}

/** لینک داخلی امن: فقط اگر isLive(path) باشد Link می‌سازد؛ وگرنه fallback (پیش‌فرض متن ساده). برای همه‌ی لینک‌های بین بسته‌ها */
export function RouteLink({ path, children, className, fallback, ...rest }: RouteLinkProps) {
  if (isLive(path)) {
    return (
      <Link href={path} className={className} {...rest}>
        {children}
      </Link>
    );
  }
  if (fallback !== undefined) return <>{fallback}</>;
  return <span className={className}>{children}</span>;
}

export interface RelatedLink {
  path: string;
  /** پیش‌فرض: label همان مسیر در SEO_ROUTES */
  label?: ReactNode;
  desc?: ReactNode;
}

/** فهرست لینک‌های مرتبط؛ لینک‌های غیر live حذف می‌شوند و اگر چیزی نماند، کل بخش نمایش داده نمی‌شود */
export function RelatedLinks({ title = "مطالب مرتبط", links, className }: { title?: ReactNode; links: (string | RelatedLink)[]; className?: string }) {
  const items = links.map((l) => (typeof l === "string" ? { path: l } : l)).filter((l) => isLive(l.path));
  if (!items.length) return null;
  return (
    <section className={cn("mb-12 print:hidden", className)}>
      <h2 className="mb-5 text-2xl font-black">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((l) => (
          <Link key={l.path} href={l.path} className="card flex items-center justify-between gap-3 p-4 font-bold hover:border-cyan/30">
            <span>
              {l.label ?? routeLabel(l.path) ?? l.path}
              {l.desc && <span className="mt-1 block text-xs font-normal leading-6 text-white/55">{l.desc}</span>}
            </span>
            <ChevronLeft aria-hidden className="size-4 shrink-0 text-white/40" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export type CalloutKind = "tip" | "konkur" | "mistake" | "example" | "teacher";

const CALLOUT: Record<CalloutKind, { label: string; Icon: typeof Lightbulb; box: string; accent: string }> = {
  tip: { label: "نکته", Icon: Lightbulb, box: "border-cyan/25 bg-cyan/5", accent: "text-cyan" },
  konkur: { label: "نکته‌ی تستی", Icon: Target, box: "border-violet/30 bg-violet/10", accent: "text-violet" },
  mistake: { label: "اشتباه رایج", Icon: AlertTriangle, box: "border-rose/30 bg-rose/5", accent: "text-rose" },
  example: { label: "مثال", Icon: Calculator, box: "border-teal/25 bg-teal/5", accent: "text-teal" },
  teacher: { label: "نکته استاد", Icon: GraduationCap, box: "border-amber/30 bg-amber/10", accent: "text-amber" },
};

/** محتوای خالی؟ (null، false، رشته‌ی خالی یا آرایه‌ای از این‌ها) */
const isEmpty = (n: ReactNode): boolean =>
  n === null || n === undefined || typeof n === "boolean" || (typeof n === "string" && !n.trim()) || (Array.isArray(n) && n.every(isEmpty));

/**
 * کادر نکته: tip «نکته»، konkur «نکته‌ی تستی»، mistake «اشتباه رایج»، example «مثال»، teacher «نکته استاد».
 * محتوای خالی → هیچ چیز نمایش داده نمی‌شود؛ «نکته استاد» فقط با متنی که خود استاد داده است.
 */
export function Callout({ kind, title, children, className }: { kind: CalloutKind; title?: ReactNode; children?: ReactNode; className?: string }) {
  if (isEmpty(children)) return null;
  const k = CALLOUT[kind];
  return (
    <aside role="note" className={cn("my-5 flex gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-8 print:break-inside-avoid", k.box, className)}>
      <k.Icon aria-hidden className={cn("mt-1.5 size-4 shrink-0", k.accent)} />
      <div className="min-w-0 flex-1">
        <p className={cn("font-black", k.accent)}>{title ?? k.label}</p>
        <div className="text-white/80">{children}</div>
      </div>
    </aside>
  );
}

/** تنها دعوت ملایم صفحه به کلاس (لنگر خدماتی به /tadris-shimi + تلفن)؛ در چاپ پنهان */
export function SoftCta({ s, text, className }: { s: SiteContent; text?: ReactNode; className?: string }) {
  return (
    <aside className={cn("card my-12 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between print:hidden", className)}>
      <div>
        <p className="text-lg font-black">کلاس خصوصی شیمی با استاد {s.teacherName}</p>
        <p className="mt-1 text-sm leading-7 text-white/65">
          {text ?? `برای رفع اشکال، برنامه‌ریزی درسی و آمادگی امتحان و کنکور، کلاس خصوصی و گروهی شیمی در ${s.city || "مشهد"} برگزار می‌شود.`}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href="/tadris-shimi" className="btn-primary">{routeLabel("/tadris-shimi")}</Link>
        {s.phone && (
          <a href={`tel:${s.phone}`} className="btn-ghost">
            <Phone aria-hidden className="size-4" /> <bdi dir="ltr">{faNum(s.phone)}</bdi>
          </a>
        )}
      </div>
    </aside>
  );
}
