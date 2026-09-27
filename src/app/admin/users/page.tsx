import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { PageHead } from "@/components/admin/ui";
import { Form, Submit } from "@/components/admin/Form";
import { ApproveButtons } from "./ApproveButtons";
import { createUser } from "./actions";
import { CLASS_STATUS_LABEL, GRADES, MAJORS, groupLabel } from "@/lib/constants";
import { faNum, fmtDate, fmtInt, toEnDigits } from "@/lib/utils";

export const metadata = { title: "دانش‌آموزان" };

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const q = toEnDigits(sp.q ?? "").trim();
  const where: Prisma.UserWhereInput = {
    ...(sp.role ? { role: sp.role as "ADMIN" } : {}),
    ...(sp.status ? { classStatus: sp.status as "PENDING" } : {}),
    ...(sp.grade ? { grade: sp.grade } : {}),
    ...(sp.major ? { major: sp.major } : {}),
    ...(sp.group ? { classGroupId: sp.group } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { city: { contains: q } }] } : {}),
  };
  const [users, total, groups] = await Promise.all([
    db.user.findMany({ where, orderBy: sp.sort === "points" ? { points: "desc" } : { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { classGroup: true } }),
    db.user.count({ where }),
    db.classGroup.findMany({ orderBy: { order: "asc" } }),
  ]);
  const qs = (o: Record<string, string | number | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHead title="دانش‌آموزان" desc={`${fmtInt(total)} نفر`} />
      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="relative lg:col-span-2">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input name="q" defaultValue={sp.q} className="input !pr-9" placeholder="نام، موبایل یا شهر" />
        </div>
        <select name="status" defaultValue={sp.status ?? ""} className="input"><option value="">همه وضعیت‌ها</option>{Object.entries(CLASS_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="grade" defaultValue={sp.grade ?? ""} className="input"><option value="">همه پایه‌ها</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
        <select name="major" defaultValue={sp.major ?? ""} className="input"><option value="">همه رشته‌ها</option>{MAJORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
        <select name="group" defaultValue={sp.group ?? ""} className="input"><option value="">همه کلاس‌ها</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <button className="btn-primary">فیلتر</button>
      </form>

      <div className="table-wrap card">
        <table className="table">
          <thead><tr><th>نام</th><th>موبایل</th><th>گروه</th><th>شهر</th><th>وضعیت</th><th><Link href={qs({ sort: "points" })}>امتیاز ↓</Link></th><th>آخرین حضور</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`} className="font-bold hover:text-cyan">{u.name || "—"}</Link>{u.role !== "USER" && <span className="chip mr-2 !text-amber">{u.role === "ADMIN" ? "مدیر" : "پشتیبان"}</span>}</td>
                <td dir="ltr" className="text-right">{faNum(u.phone)}</td>
                <td className="whitespace-nowrap text-xs">{groupLabel(u.grade, u.major)}</td>
                <td className="text-xs">{u.city ?? "—"}</td>
                <td className="text-xs">
                  <span className={u.classStatus === "APPROVED" ? "text-lime" : u.classStatus === "PENDING" ? "text-amber" : "text-white/50"}>{CLASS_STATUS_LABEL[u.classStatus]}</span>
                  {u.classGroup && <p className="text-[10px] text-white/40">{u.classGroup.name}</p>}
                </td>
                <td className="font-bold">{fmtInt(u.points)}</td>
                <td className="whitespace-nowrap text-xs text-white/50">{fmtDate(u.lastSeenAt, true)}</td>
                <td>{u.classStatus === "PENDING" && <ApproveButtons id={u.id} />}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-white/45">کاربری یافت نشد</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && <Link href={qs({ page: page - 1 })} className="btn-ghost btn-sm">قبلی</Link>}
          <span className="btn btn-sm">{faNum(page)} از {faNum(Math.ceil(total / 50))}</span>
          {page * 50 < total && <Link href={qs({ page: page + 1 })} className="btn-ghost btn-sm">بعدی</Link>}
        </div>
      )}

      <details className="card mt-6 p-5">
        <summary className="flex cursor-pointer items-center gap-2 font-black"><UserPlus className="size-5 text-cyan" /> افزودن دستی دانش‌آموز</summary>
        <Form action={createUser} reset className="mt-4 grid gap-3 sm:grid-cols-3">
          <input name="phone" className="input" placeholder="موبایل *" dir="ltr" required />
          <input name="name" className="input" placeholder="نام و نام خانوادگی" />
          <select name="classGroupId" className="input"><option value="">کلاس</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <select name="grade" className="input"><option value="">پایه</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
          <select name="major" className="input"><option value="">رشته</option>{MAJORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="approved" defaultChecked className="size-4 accent-cyan-400" /> شاگرد تأییدشده</label>
          <Submit className="btn-primary sm:col-span-3">افزودن</Submit>
        </Form>
      </details>
    </div>
  );
}
