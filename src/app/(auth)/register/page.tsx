import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata = { title: "تکمیل ثبت‌نام" };

export default async function Register() {
  const user = await requireUser({ allowIncomplete: true });
  const groups = await db.classGroup.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  return (
    <div className="card glow-border p-7">
      <h1 className="mb-1 text-xl font-black">تکمیل ثبت‌نام</h1>
      <p className="mb-6 text-sm text-white/55">فقط یک‌بار؛ برای اینکه ویدیوها و آزمون‌های مناسب پایه و رشته‌ات رو ببینی.</p>
      <ProfileForm
        mode="register"
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        initial={{
          name: user.name, grade: user.grade ?? "", major: user.major ?? "", province: user.province ?? "خراسان رضوی", city: user.city ?? "",
          address: user.address ?? "", school: user.school ?? "", parentPhone: user.parentPhone ?? "", parentSms: user.parentSms,
          classStudent: user.classStatus === "PENDING" || user.classStatus === "APPROVED", classGroupId: user.classGroupId ?? "", classStatus: user.classStatus,
        }}
      />
    </div>
  );
}
