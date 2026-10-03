/**
 * اصلاح‌های یک‌باره‌ی داده روی سرور (هر بار update اجرا می‌شود و تکرارش بی‌خطر است).
 *   pnpm db:fixes
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/** متن‌هایی که در تنظیمات «site» (متن‌های سایت) جایگزین می‌شوند */
const SITE_REPLACE: [RegExp, string][] = [
  [/لیسانس مهندسی شیمی/g, "کارشناسی ارشد مهندسی شیمی"],
];

async function main() {
  const row = await db.setting.findUnique({ where: { key: "site" } });
  if (!row) return; // هنوز از پنل ذخیره نشده؛ مقدار پیش‌فرض کد استفاده می‌شود
  const before = JSON.stringify(row.value);
  let after = before;
  for (const [re, to] of SITE_REPLACE) after = after.replace(re, to);
  if (after !== before) {
    await db.setting.update({ where: { key: "site" }, data: { value: JSON.parse(after) } });
    console.log("✔ متن‌های سایت اصلاح شد");
  }
}

main().finally(() => db.$disconnect());
