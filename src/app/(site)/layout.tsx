import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { buildNav } from "@/components/site/nav";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

/**
 * صفحه‌های عمومی ایستا/ISR هستند: این layout کوکی نمی‌خواند (وضعیت ورود را هدر در مرورگر از /api/me می‌گیرد).
 * محتوای تنظیمات (تلفن، آدرس…) هر ۵ دقیقه تازه می‌شود؛ ذخیره در مدیریت هم revalidatePath("/", "layout") می‌زند.
 */
export const revalidate = 300;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, articles] = await Promise.all([getSetting("site"), db.article.count({ where: { published: true } }).catch(() => 0)]);
  return (
    <>
      {/* بافت دانه‌دانه فقط در صفحه‌های معرفی سایت (نه پنل و مدیریت که ویدیو پخش می‌شود) */}
      <div className="grain" aria-hidden />
      <Header nav={buildNav({ articles })} />
      {children}
      <Footer site={site} articles={articles} />
    </>
  );
}
