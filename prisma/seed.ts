/**
 * داده‌های اولیه:
 *   pnpm db:seed            → مدیر + الگوهای پیامک + فصل‌های کتاب شیمی
 *   pnpm db:seed -- --demo  → به‌علاوه‌ی دانش‌آموزان، آزمون و فعالیت نمونه (برای تست)
 * رمز مدیر: متغیر ADMIN_PASSWORD (پیش‌فرض doping1234) — بعد از اولین ورود از پنل تغییر دهید.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { SMS_TEMPLATES } from "../src/lib/sms/templates";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const hash = (pw: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
};
const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(d);
};

const CHAPTERS: Record<string, string[]> = {
  G10: ["کیهان، زادگاه الفبای هستی", "ردپای گازها در زندگی", "آب، آهنگ زندگی"],
  G11: ["قدر هدایای زمینی را بدانیم", "در پی غذای سالم", "پوشاک، نیازی پایان‌ناپذیر"],
  G12: ["مولکول‌ها در خدمت تندرستی", "آسایش و رفاه در سایه‌ی شیمی", "شیمی، جلوه‌ای از هنر، زیبایی و ماندگاری", "شیمی، راهی به سوی آینده‌ای روشن‌تر"],
};

async function main() {
  const demo = process.argv.includes("--demo");
  const adminPhone = process.env.ADMIN_PHONE || "09158148172";
  const pw = process.env.ADMIN_PASSWORD || "doping1234";
  const admin = await db.user.findUnique({ where: { phone: adminPhone } });
  if (!admin) {
    await db.user.create({ data: { phone: adminPhone, name: "جواد پرتویی", role: "ADMIN", passwordHash: hash(pw), profileDone: true } });
    console.log(`✔ مدیر ساخته شد: ${adminPhone} / ${pw}`);
  } else if (admin.role !== "ADMIN") {
    await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN", passwordHash: admin.passwordHash ?? hash(pw) } });
    console.log(`✔ ${adminPhone} مدیر شد`);
  }

  for (const t of SMS_TEMPLATES) {
    await db.smsTemplate.upsert({ where: { key: t.key }, create: { key: t.key, name: t.name, body: t.body }, update: {} });
  }

  if ((await db.topic.count()) === 0) {
    for (const [grade, list] of Object.entries(CHAPTERS)) {
      let i = 0;
      for (const title of list) {
        await db.topic.create({ data: { title: `فصل ${["اول", "دوم", "سوم", "چهارم"][i]}: ${title}`, grade, order: i++, price: 390000 } });
      }
    }
    console.log("✔ فصل‌های کتاب شیمی ساخته شد");
  }
  if ((await db.classGroup.count()) === 0) {
    await db.classGroup.createMany({
      data: [
        { name: "دوازدهم تجربی — هاشمی‌نژاد ۱", grade: "G12", major: "TAJROBI", location: "دبیرستان هاشمی‌نژاد ۱", order: 1 },
        { name: "دوازدهم ریاضی — هاشمی‌نژاد ۱", grade: "G12", major: "RIAZI", location: "دبیرستان هاشمی‌نژاد ۱", order: 2 },
        { name: "یازدهم — کلاس آموزشگاه", grade: "G11", location: "آموزشگاه", order: 3 },
        { name: "دهم — کلاس آموزشگاه", grade: "G10", location: "آموزشگاه", order: 4 },
      ],
    });
    console.log("✔ کلاس‌های نمونه ساخته شد (از پنل قابل ویرایش است)");
  }

  if (!demo) return;

  // ─── داده‌های نمایشی ───
  const topics = await db.topic.findMany({ where: { grade: "G12" }, orderBy: { order: "asc" } });
  for (const t of topics) {
    if (await db.video.count({ where: { topicId: t.id } })) continue;
    for (let j = 0; j < 4; j++) {
      await db.video.create({ data: { topicId: t.id, title: `جلسه ${j + 1} — ${["مفاهیم پایه", "حل تمرین", "تست‌های کنکور", "جمع‌بندی"][j]}`, durationSec: 1500 + j * 420, isFree: j === 0, order: j } });
    }
  }
  const bundle = await db.bundle.findFirst();
  if (!bundle) await db.bundle.create({ data: { title: "بسته جامع شیمی دوازدهم", price: 1290000, topics: { connect: topics.map((t) => ({ id: t.id })) } } });

  const group = await db.classGroup.findFirst({ where: { grade: "G12", major: "TAJROBI" } });
  const names = ["علی رضایی", "سارا محمدی", "امیر حسینی", "نگار کریمی", "محمد جعفری", "زهرا احمدی", "حسین موسوی", "فاطمه رحیمی", "رضا نوری", "مریم صادقی"];
  const users = [];
  for (let i = 0; i < names.length; i++) {
    const phone = `0915000${String(1000 + i).slice(-4)}`;
    const u = await db.user.upsert({
      where: { phone },
      create: { phone, name: names[i], grade: "G12", major: i % 3 === 2 ? "RIAZI" : "TAJROBI", city: "مشهد", province: "خراسان رضوی", profileDone: true, classStatus: i < 7 ? "APPROVED" : i < 9 ? "PENDING" : "NONE", classGroupId: i < 9 ? group?.id : null },
      update: {},
    });
    users.push(u);
  }

  let exams = await db.exam.findMany({ orderBy: { createdAt: "asc" } });
  if (exams.length === 0) {
    const titles = ["آزمون فصل ۱ — مولکول‌ها در خدمت تندرستی", "آزمون فصل ۲ — الکتروشیمی", "آزمون جامع میان‌دوره", "آزمون فصل ۳ — شیمی هنر", "آزمون جامع پایانی"];
    for (let k = 0; k < titles.length; k++) {
      const ex = await db.exam.create({
        data: { title: titles[k], grade: "G12", audience: "STUDENTS", durationMin: 20, published: true, kind: k === 2 ? "EXTERNAL" : "INTERNAL", externalUrl: k === 2 ? "https://peleyad.com/" : null, createdAt: new Date(Date.now() - (40 - k * 8) * 86400000) },
      });
      if (ex.kind === "INTERNAL") {
        const qs = [
          ["کدام گزینه pH محلول ۰٫۰۱ مولار HCl را درست نشان می‌دهد؟", ["۱", "۲", "۱۲", "۱۳"], 1],
          ["در سلول گالوانی روی–مس، کدام الکترود آند است؟", ["مس", "روی", "هر دو", "هیچ‌کدام"], 1],
          ["کدام ترکیب صابون محسوب می‌شود؟", ["C17H35COONa", "CH3COOH", "C6H6", "NaCl"], 0],
          ["عدد اکسایش گوگرد در H2SO4 چند است؟", ["+۴", "+۶", "-۲", "+۲"], 1],
          ["کدام عامل سرعت واکنش را افزایش نمی‌دهد؟", ["افزایش دما", "کاتالیزگر", "کاهش سطح تماس", "افزایش غلظت"], 2],
        ] as const;
        let o = 0;
        for (const [text, options, correct] of qs) await db.question.create({ data: { examId: ex.id, order: o++, text, options: [...options], correct } });
      }
    }
    exams = await db.exam.findMany({ orderBy: { createdAt: "asc" } });
    for (const u of users.slice(0, 8)) {
      let base = 35 + Math.random() * 30;
      for (const ex of exams) {
        base = Math.min(98, base + (Math.random() * 14 - 3));
        const n = 5;
        const correct = Math.round((base / 100) * n);
        await db.examResult.create({
          data: {
            examId: ex.id, userId: u.id, status: "SUBMITTED", source: ex.kind === "EXTERNAL" ? "IMPORT" : "INTERNAL",
            startedAt: ex.createdAt, submittedAt: new Date(ex.createdAt.getTime() + 3600000),
            correct, wrong: Math.max(0, n - correct - 1), blank: Math.min(1, n - correct),
            percent: ex.kind === "EXTERNAL" ? null : Math.round(base * 10) / 10,
            score: ex.kind === "EXTERNAL" ? Math.round(base) : null, taraz: ex.kind === "EXTERNAL" ? Math.round(4000 + base * 30) : null,
          },
        });
      }
    }
  }
  for (const u of users) {
    for (let d = -29; d <= 0; d++) {
      if (Math.random() < 0.35) continue;
      const videoSec = Math.round(Math.random() * 3600);
      const onlineSec = videoSec + Math.round(Math.random() * 1800);
      const points = Math.round(3 + videoSec / 300 + Math.random() * 10);
      await db.activity.upsert({ where: { userId_day: { userId: u.id, day: day(d) } }, create: { userId: u.id, day: day(d), videoSec, onlineSec, points }, update: {} });
    }
    const total = await db.activity.aggregate({ where: { userId: u.id }, _sum: { points: true } });
    await db.user.update({ where: { id: u.id }, data: { points: (total._sum.points ?? 0) + 60 } });
    const vids = await db.video.findMany({ take: 6 });
    for (const v of vids) {
      if (Math.random() < 0.4) continue;
      const w = Math.round(v.durationSec * (0.3 + Math.random() * 0.8));
      await db.videoProgress.upsert({ where: { userId_videoId: { userId: u.id, videoId: v.id } }, create: { userId: u.id, videoId: v.id, watchedSeconds: w, lastPosition: Math.min(w, v.durationSec), completed: w > v.durationSec * 0.85 }, update: {} });
    }
  }
  console.log("✔ داده‌های نمایشی ساخته شد (دانش‌آموز نمونه: 09150001000)");
}

main().finally(() => db.$disconnect());
