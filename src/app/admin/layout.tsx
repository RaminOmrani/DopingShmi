import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";

// noindex,follow: صفحه‌های مدیریت هرگز در نتایج جست‌وجو نمی‌آیند (robots.txt هم آن‌ها را بسته است)
export const metadata = { title: { default: "پنل مدیریت", template: "%s | مدیریت دوپینگ شیمی" }, robots: { index: false, follow: true } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [pending, payReview] = await Promise.all([db.user.count({ where: { classStatus: "PENDING" } }), db.payment.count({ where: { status: "REVIEW" } })]);
  return (
    <div className="min-h-dvh lg:flex">
      <AdminNav pending={pending} payReview={payReview} />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 md:px-7">{children}</main>
    </div>
  );
}
