import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = { title: { default: "پنل مدیریت", template: "%s | مدیریت دوپینگ شیمی" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const pending = await db.user.count({ where: { classStatus: "PENDING" } });
  return (
    <div className="min-h-dvh lg:flex">
      <AdminNav pending={pending} />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 md:px-7">{children}</main>
    </div>
  );
}
