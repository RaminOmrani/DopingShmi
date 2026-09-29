import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { Toaster } from "@/components/ui/Toast";
import { themeInitScript } from "@/components/Theme";
import { getSetting } from "@/lib/settings";
import { KEYWORDS, SITE_URL } from "@/lib/seo";

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
    alternates: { canonical: "/" },
    appleWebApp: { capable: true, title: site.brand, statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: "/icons/favicon-64.png", sizes: "64x64" }, { url: "/logo.svg", type: "image/svg+xml" }],
      apple: "/icons/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: site.brand,
      title: site.seoTitle,
      description: site.seoDescription,
      url: SITE_URL,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: `${site.brand} — استاد ${site.teacherName}` }],
    },
    twitter: { card: "summary_large_image", title: site.seoTitle, description: site.seoDescription, images: ["/og.png"] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
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
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* ثبت سرویس‌ورکر به‌صورت اسکریپت مستقیم تا PWABuilder و گوگل آن را تشخیص دهند */}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})})}" }} />
      </head>
      <body className="antialiased">
        <div className="aurora" aria-hidden />
        <div className="grain" aria-hidden />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
