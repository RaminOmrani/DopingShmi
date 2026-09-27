import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { Toaster } from "@/components/ui/Toast";
import { themeInitScript } from "@/components/Theme";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://dopingshimi.ir"),
  title: { default: "دوپینگ شیمی | استاد جواد پرتویی", template: "%s | دوپینگ شیمی" },
  description:
    "دوپینگ شیمی؛ کلاس‌ها، همایش‌ها، ویدیوهای آموزشی و آزمون‌های شیمی کنکور استاد جواد پرتویی — مدرس رتبه‌های ۱۰، ۳۸ و ۱۰۸ کنکور ۱۴۰۴.",
  applicationName: "دوپینگ شیمی",
  keywords: ["شیمی کنکور", "جواد پرتویی", "دوپینگ شیمی", "همایش شیمی", "آموزش شیمی", "مشهد"],
  appleWebApp: { capable: true, title: "دوپینگ شیمی", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/favicon-64.png", sizes: "64x64" }, { url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: { type: "website", locale: "fa_IR", siteName: "دوپینگ شیمی", images: ["/icons/icon-512.png"] },
  formatDetection: { telephone: false },
};

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
      </head>
      <body className="antialiased">
        <div className="aurora" aria-hidden />
        <div className="grain" aria-hidden />
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
