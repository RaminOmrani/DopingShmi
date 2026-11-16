import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import "./globals.css";
import { Toaster } from "@/components/ui/Toast";
import { themeInitScript } from "@/components/Theme";
import { getSetting } from "@/lib/settings";
import { KEYWORDS, SITE_URL } from "@/lib/seo";
import { DEFAULT_OG_IMAGE } from "@/lib/page-meta";

/**
 * متادیتای پایه‌ی همه‌ی صفحه‌ها. عمداً canonical، og:url و عنوان/توضیح Open Graph ندارد:
 * ادغام متادیتا در Next سطحی است و این‌ها به هر صفحه‌ای که خودش تعیین نکرده نشت می‌کرد
 * (مثلاً canonical «/» روی /gallery و صفحه‌ی ۴۰۴). صفحه‌های عمومی همه را با pageMeta می‌سازند.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSetting("site");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.seoTitle, template: `%s | ${site.brand}` },
    description: site.seoDescription,
    applicationName: site.brand,
    keywords: KEYWORDS,
    authors: [{ name: site.teacherName, url: `${SITE_URL}/javad-partovi` }],
    creator: site.teacherName,
    publisher: site.brand,
    appleWebApp: { capable: true, title: site.brand, statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: "/icons/favicon-64.png", sizes: "64x64" }, { url: "/logo.svg", type: "image/svg+xml" }],
      apple: "/icons/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: site.brand,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: `${site.brand}، استاد ${site.teacherName}` }],
    },
    twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE] },
    // فقط تنظیمات گوگل‌بات؛ index/follow پیش‌فرض است و صفحه‌ی ۴۰۴ فقط یک متای robots (noindex) می‌گیرد
    robots: { googleBot: { "max-image-preview": "large", "max-snippet": -1 } },
    verification: {
      google: site.googleVerification || undefined,
      other: site.bingVerification ? { "msvalidate.01": site.bingVerification } : undefined,
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#03040b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // زیرمجموعه‌ی فارسی فونت از همان ابتدا دانلود شود (پیش از خواندن CSS) تا جابه‌جایی متن (CLS) کم شود
  preload("/fonts/vazirmatn-arabic-wght-normal.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* ثبت سرویس‌ورکر به‌صورت اسکریپت مستقیم تا PWABuilder و گوگل آن را تشخیص دهند */}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})})}" }} />
      </head>
      <body className="antialiased">
        <div className="aurora" aria-hidden />
        {/* لایه‌ی grain فقط در صفحه‌های سایت ((site)/layout.tsx)؛ روی پلیر ویدیوی پنل لایه‌ی mix-blend نمی‌نشیند */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
