import Link from "next/link";
import { Phone, MapPin } from "lucide-react";
import type { SiteContent } from "@/lib/settings";
import { TelegramIcon, BaleIcon, InstagramIcon } from "./BrandIcons";
import { faNum } from "@/lib/utils";

export function SocialLinks({ site, size = "md" }: { site: SiteContent; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "size-14 rounded-2xl" : "size-11 rounded-xl";
  const items = [
    site.phone && { href: `tel:${site.phone}`, label: "تماس", icon: <Phone className="size-5" />, color: "hover:text-emerald-300 hover:border-emerald-400/40" },
    site.telegram && { href: site.telegram, label: "تلگرام", icon: <TelegramIcon />, color: "hover:text-sky-300 hover:border-sky-400/40" },
    site.bale && { href: site.bale, label: "بله", icon: <BaleIcon />, color: "hover:text-teal-300 hover:border-teal-400/40" },
    site.instagram && { href: site.instagram, label: "اینستاگرام", icon: <InstagramIcon />, color: "hover:text-pink-300 hover:border-pink-400/40" },
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

export function Footer({ site }: { site: SiteContent }) {
  return (
    <footer className="relative mt-24 border-t border-white/5">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          <div className="mb-4 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="size-11" />
            <div>
              <p className="text-lg font-black">{site.brand}</p>
              <p className="text-xs text-white/50">استاد {site.teacherName}</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-white/55">{site.tagline}</p>
        </div>
        <div>
          <p className="mb-4 font-bold">دسترسی سریع</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
            <Link href="/courses" className="hover:text-cyan">ویدیوهای آموزشی</Link>
            <Link href="/gallery" className="hover:text-cyan">گالری همایش‌ها</Link>
            <Link href="/login" className="hover:text-cyan">ورود دانش‌آموزان</Link>
            <Link href="/panel/exams" className="hover:text-cyan">آزمون‌ها</Link>
            <Link href="/#ranks" className="hover:text-cyan">رتبه‌های برتر</Link>
            <Link href="/#contact" className="hover:text-cyan">تماس با ما</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 font-bold">ارتباط</p>
          {site.phone && <p className="mb-2 flex items-center gap-2 text-sm text-white/60"><Phone className="size-4 text-cyan" /> <span dir="ltr">{faNum(site.phone)}</span></p>}
          {site.address && <p className="mb-4 flex items-center gap-2 text-sm text-white/60"><MapPin className="size-4 text-cyan" /> {site.address}</p>}
          <SocialLinks site={site} />
        </div>
      </div>
      <p className="border-t border-white/5 py-6 text-center text-xs text-white/40">{site.footerText}</p>
    </footer>
  );
}
