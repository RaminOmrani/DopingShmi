import { Phone, MapPin, TvMinimalPlay, Clapperboard } from "lucide-react";
import type { SiteContent } from "@/lib/settings";
import { GRADE_PAGES } from "@/lib/syllabus";
import { GRADE_KEYS, QUIZ_HUB, TOOL_PATHS, gradeName, isLive, label } from "@/lib/site-routes";
import { RouteLink } from "@/components/seo/EduChrome";
import { TelegramIcon, BaleIcon, InstagramIcon } from "./BrandIcons";
import { faNum } from "@/lib/utils";

export function SocialLinks({ site, size = "md" }: { site: SiteContent; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "size-14 rounded-2xl" : "size-11 rounded-xl";
  const items = [
    site.phone && { href: `tel:${site.phone}`, label: "تماس", icon: <Phone className="size-5" />, color: "hover:text-emerald-300 hover:border-emerald-400/40" },
    site.telegram && { href: site.telegram, label: "تلگرام", icon: <TelegramIcon />, color: "hover:text-sky-300 hover:border-sky-400/40" },
    site.bale && { href: site.bale, label: "بله", icon: <BaleIcon />, color: "hover:text-teal-300 hover:border-teal-400/40" },
    site.instagram && { href: site.instagram, label: "اینستاگرام", icon: <InstagramIcon />, color: "hover:text-pink-300 hover:border-pink-400/40" },
    site.aparat && { href: site.aparat, label: "آپارات", icon: <Clapperboard className="size-5" />, color: "hover:text-rose-300 hover:border-rose-400/40" },
    site.youtube && { href: site.youtube, label: "یوتیوب", icon: <TvMinimalPlay className="size-5" />, color: "hover:text-red-300 hover:border-red-400/40" },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode; color: string }[];
  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((i) => (
        <a key={i.label} href={i.href} target={i.href.startsWith("http") ? "_blank" : undefined} rel="noopener" aria-label={i.label} title={i.label}
          className={`glass grid ${cls} place-items-center text-white/80 transition hover:-translate-y-1 ${i.color}`}>
          {i.icon}
        </a>
      ))}
    </div>
  );
}

type FooterLink = { path: string; text: string };

/**
 * ستون‌های پیوند فوتر: آموزش، ابزار و مرجع، آزمون و کنکور، استاد و کلاس.
 * فقط صفحه‌های live (isLive)؛ ستونی که پیوند live ندارد پنهان می‌شود. هیچ پیوندی به مسیرهای بسته در robots.txt نیست.
 */
function footerColumns(site: SiteContent, articles: number): { title: string; links: FooterLink[] }[] {
  const reg = (path: string, text?: string): FooterLink => ({ path, text: text ?? label(path) ?? path });
  const cols = [
    {
      title: "آموزش",
      links: [
        ...GRADE_KEYS.map((g) => reg(GRADE_PAGES[g].path, `آموزش شیمی ${gradeName(g)}`)),
        reg("/courses"),
        ...(articles > 0 ? [reg("/articles")] : []),
      ],
    },
    { title: "ابزار و مرجع", links: [TOOL_PATHS.periodic, TOOL_PATHS.molarMass, TOOL_PATHS.balance, TOOL_PATHS.ph, TOOL_PATHS.formulas].map((p) => reg(p)) },
    { title: "آزمون و کنکور", links: [reg(QUIZ_HUB), reg("/shimi-konkur"), reg("/#ranks", "رتبه‌های برتر کنکور")] },
    {
      title: "استاد و کلاس",
      links: [reg("/javad-partovi", `استاد ${site.teacherName}`), reg("/tadris-shimi"), reg("/gallery"), reg("/#contact", "تماس با ما")],
    },
  ];
  return cols.map((c) => ({ ...c, links: c.links.filter((l) => isLive(l.path)) })).filter((c) => c.links.length > 0);
}

export function Footer({ site, articles = 0 }: { site: SiteContent; articles?: number }) {
  const cols = footerColumns(site, articles);
  return (
    <footer className="relative mt-24 border-t border-white/5 print:hidden">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_2.4fr]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={44} height={44} className="size-11" />
            <div>
              <p className="text-lg font-black">{site.brand}</p>
              <p className="text-xs text-white/50">استاد {site.teacherName}</p>
            </div>
          </div>
          <p className="mb-5 text-sm leading-7 text-white/55">{site.tagline}</p>
          {site.phone && <p className="mb-2 flex items-center gap-2 text-sm text-white/60"><Phone className="size-4 text-cyan" /> <span dir="ltr">{faNum(site.phone)}</span></p>}
          {site.address && <p className="mb-4 flex items-center gap-2 text-sm text-white/60"><MapPin className="size-4 text-cyan" /> {site.address}</p>}
          <SocialLinks site={site} />
        </div>
        <nav aria-label="پیوندهای سایت" className={`grid grid-cols-2 gap-8 ${cols.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="mb-4 font-bold">{c.title}</p>
              <ul className="grid gap-2.5 text-sm text-white/60">
                {c.links.map((l) => (
                  <li key={l.path}>
                    <RouteLink path={l.path} fallback={null} className="hover:text-cyan">{l.text}</RouteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <p className="border-t border-white/5 py-6 text-center text-xs text-white/40">{site.footerText}</p>
    </footer>
  );
}
