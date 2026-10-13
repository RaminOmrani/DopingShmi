/**
 * انتقال ویدیوها از تلگرام به پلتفرم ویدیوی آروان — مستقیم روی سرور (بدون دانلود روی کامپیوتر خودتان).
 *
 *   pnpm tg login                          ورود یک‌باره به تلگرام (api_id و api_hash از my.telegram.org)
 *   pnpm tg chats                          فهرست گفتگوهای اخیر و شناسه‌ی هر کدام
 *   pnpm tg videos <chat> [--all]          فهرست ویدیوهای یک گفتگو (بدون انتقال)
 *   pnpm tg import <chat> [--all] [--limit N] [--channel ID] [--profile ID]
 *                                          انتقال به آروان؛ قابل ادامه — ویدیوهای منتقل‌شده دوباره منتقل نمی‌شوند
 *   pnpm tg status                         وضعیت انتقال‌ها
 *   pnpm tg logout                         خروج و حذف نشست تلگرام از سرور
 *
 * <chat>: شناسه‌ی عددی از «pnpm tg chats»، ‎@username یا شماره‌ی موبایل مخاطب.
 * پیش‌فرض فقط ویدیوهایی که طرف مقابل فرستاده؛ با ‎--all ویدیوهایی که خودتان فرستاده‌اید هم حساب می‌شوند.
 * برای اجرای طولانی در پس‌زمینه: bash deploy/tg-import.sh <chat>
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import bigInt from "big-integer";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Logger, LogLevel } from "telegram/extensions/Logger";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { arvanApi, fileIdFromUploadUrl } from "../src/lib/arvan-api";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// روی سرور: ‎/var/lib/doping (کنار پوشه‌ی uploads)
const DATA_DIR = process.env.TG_DATA_DIR || path.resolve(process.env.UPLOAD_DIR || "./uploads", "..");
const SESSION_FILE = path.join(DATA_DIR, ".telegram-session.json");
const TMP_DIR = path.join(DATA_DIR, "tg-tmp");
const LOCK_FILE = path.join(TMP_DIR, ".lock");
const CHUNK = 512 * 1024; // حداکثر اندازه‌ی هر درخواست دانلود تلگرام
const TTY = process.stdout.isTTY;

const die = (msg: string): never => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 1024 ** 3 ? 1 : 0)}MB`;
const gb = (n: number) => `${(n / 1024 ** 3).toFixed(2)}GB`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
    if (!muted) process.stdout.write(s);
  };
  return new Promise((resolve) => {
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a.trim());
    });
    muted = hidden;
  });
}

type Saved = { apiId: number; apiHash: string; session: string };
const readSession = (): Saved | null => {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return null;
  }
};

function makeClient(s: Saved) {
  return new TelegramClient(new StringSession(s.session), s.apiId, s.apiHash, {
    connectionRetries: 10,
    autoReconnect: true,
    floodSleepThreshold: 900,
    baseLogger: new Logger(LogLevel.ERROR),
  });
}

async function connect() {
  const s = readSession() ?? die("اول وارد تلگرام شوید:  pnpm tg login");
  const client = makeClient(s);
  await client.connect();
  if (!(await client.checkAuthorization())) die("نشست تلگرام معتبر نیست؛ دوباره:  pnpm tg login");
  return client;
}

async function finish(client?: TelegramClient, code = 0) {
  await db.$disconnect().catch(() => {});
  if (client) await client.destroy().catch(() => {});
  process.exit(code);
}

// ─── login / logout ───
async function login() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log("ورود به تلگرام روی سرور. api_id و api_hash را از my.telegram.org ← API development tools بگیرید.\n");
  const apiId = Number(await ask("api_id: "));
  if (!Number.isInteger(apiId) || apiId <= 0) die("api_id باید عدد باشد");
  const apiHash = await ask("api_hash (نمایش داده نمی‌شود): ", true);
  if (!/^[0-9a-f]{32}$/i.test(apiHash)) die("api_hash باید ۳۲ حرف باشد");
  const client = makeClient({ apiId, apiHash, session: "" });
  await client.start({
    phoneNumber: async () => {
      const p = await ask("شماره موبایل تلگرام (مثل 09121234567): ");
      return p.replace(/^0(9\d{9})$/, "+98$1");
    },
    phoneCode: async () => ask("کدی که در خود تلگرام برایتان آمد: "),
    password: async () => ask("رمز تأیید دومرحله‌ای تلگرام (نمایش داده نمی‌شود): ", true),
    onError: (e) => console.error(`✖ ${e.message}`),
  });
  const session = (client.session as StringSession).save();
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ apiId, apiHash, session }), { mode: 0o600 });
  fs.chmodSync(SESSION_FILE, 0o600);
  const me = (await client.getMe()) as Api.User;
  console.log(`\n✔ وارد شدید: ${[me.firstName, me.lastName].filter(Boolean).join(" ")}`);
  console.log("بعد از پایان انتقال حتماً «pnpm tg logout» را بزنید.");
  await finish(client);
}

async function logout() {
  const s = readSession();
  if (s) {
    const client = makeClient(s);
    try {
      await client.connect();
      await client.invoke(new Api.auth.LogOut());
    } catch {
      /* نشست از قبل باطل شده */
    }
    await client.destroy().catch(() => {});
    fs.rmSync(SESSION_FILE, { force: true });
  }
  console.log("✔ نشست تلگرام از سرور حذف شد.");
  await finish();
}

// ─── گفتگوها و ویدیوها ───
async function chats() {
  const client = await connect();
  const dialogs = await client.getDialogs({ limit: 40 });
  console.log("شناسه                نوع   نام");
  for (const d of dialogs) console.log(`${String(d.id).padEnd(20)}  ${d.isUser ? "👤" : d.isChannel ? "📢" : "👥"}   ${d.title || d.name || ""}`);
  console.log("\nشناسه‌ی گفتگوی موردنظر را در دستور videos یا import بنویسید.");
  await finish(client);
}

async function resolveChat(client: TelegramClient, arg: string) {
  const dialogs = await client.getDialogs({ limit: 500 });
  const hit = dialogs.find((d) => String(d.id) === arg || String(d.entity?.id) === arg);
  if (hit?.entity) return { entity: hit.entity, id: String(hit.id), title: hit.title || "" };
  const q = arg.replace(/^0(9\d{9})$/, "+98$1");
  try {
    const e = await client.getEntity(q);
    return { entity: e, id: String(e.id), title: "title" in e ? String(e.title) : [("firstName" in e && e.firstName) || "", ("lastName" in e && e.lastName) || ""].join(" ").trim() };
  } catch {
    return die(`گفتگوی «${arg}» پیدا نشد. با «pnpm tg chats» شناسه را ببینید.`);
  }
}

interface TgVideo {
  n: number;
  msgId: number;
  title: string;
  fileName: string;
  mime: string;
  size: number;
  duration: number;
  date: Date;
}

async function listVideos(client: TelegramClient, entity: Api.TypeEntityLike, includeOut: boolean) {
  const out: TgVideo[] = [];
  for await (const m of client.iterMessages(entity, { reverse: true })) {
    if (!(m instanceof Api.Message) || (m.out && !includeOut)) continue;
    const media = m.media;
    if (!(media instanceof Api.MessageMediaDocument) || !(media.document instanceof Api.Document)) continue;
    const doc = media.document;
    const va = doc.attributes.find((a): a is Api.DocumentAttributeVideo => a instanceof Api.DocumentAttributeVideo);
    const animated = doc.attributes.some((a) => a instanceof Api.DocumentAttributeAnimated);
    if (animated || va?.roundMessage) continue; // گیف و ویدیوی دایره‌ای
    if (!va && !doc.mimeType?.startsWith("video/")) continue;
    const fname = doc.attributes.find((a): a is Api.DocumentAttributeFilename => a instanceof Api.DocumentAttributeFilename)?.fileName;
    const n = out.length + 1;
    const ext = path.extname(fname || "") || `.${(doc.mimeType || "video/mp4").split("/")[1]?.replace("quicktime", "mov") || "mp4"}`;
    const caption = (m.message || "").split("\n").map((l) => l.trim()).find(Boolean);
    out.push({
      n,
      msgId: m.id,
      title: (caption || (fname ? path.basename(fname, path.extname(fname)) : "") || `ویدیو ${n}`).slice(0, 150),
      fileName: fname || `video-${m.id}${ext}`,
      mime: doc.mimeType || "video/mp4",
      size: Number(doc.size),
      duration: Number(va?.duration || 0),
      date: new Date(m.date * 1000),
    });
  }
  return out;
}

async function videos(arg: string, includeOut: boolean) {
  const client = await connect();
  const chat = await resolveChat(client, arg);
  const list = await listVideos(client, chat.entity, includeOut);
  console.log(`گفتگو: ${chat.title}\n`);
  for (const v of list) console.log(`${String(v.n).padStart(3)}.  ${mb(v.size).padStart(9)}  ${clock(v.duration).padStart(7)}  ${v.date.toISOString().slice(0, 10)}  ${v.title}`);
  console.log(`\nجمع: ${list.length} ویدیو، ${gb(list.reduce((a, v) => a + v.size, 0))}`);
  await finish(client);
}

// ─── انتقال ───
function freeBytes(dir: string) {
  const s = fs.statfsSync(dir);
  return Number(s.bavail) * Number(s.bsize);
}

function takeLock() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  try {
    const pid = Number(fs.readFileSync(LOCK_FILE, "utf8"));
    if (pid && pid !== process.pid) {
      process.kill(pid, 0); // اگر زنده باشد خطا نمی‌دهد
      die(`یک انتقال دیگر در حال اجراست (pid ${pid}). برای توقف: bash deploy/tg-import.sh stop`);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EPERM") die("یک انتقال دیگر در حال اجراست");
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  process.on("exit", () => fs.rmSync(LOCK_FILE, { force: true }));
}

/** گزارش پیشرفت: در ترمینال یک خط زنده، در فایل لاگ هر ۳۰ ثانیه یک خط؛ در دیتابیس هر ۱۰ ثانیه */
function progress(id: string, label: string, total: number) {
  const t0 = Date.now();
  let lastLog = 0;
  let lastDb = 0;
  let base = -1;
  return (done: number) => {
    const now = Date.now();
    if (base < 0) base = done;
    const pct = Math.min(100, Math.floor((done / total) * 100));
    const speed = (done - base) / Math.max(1, (now - t0) / 1000);
    const line = `   ${label} ${pct}%  ${mb(done)}/${mb(total)}  ${mb(speed)}/s`;
    if (TTY) process.stdout.write(`\r${line.padEnd(70)}`);
    else if (now - lastLog > 30000) {
      console.log(line);
      lastLog = now;
    }
    if (now - lastDb > 10000) {
      lastDb = now;
      db.videoImport.update({ where: { id }, data: { progress: pct } }).catch(() => {});
    }
  };
}

async function download(client: TelegramClient, entity: Api.TypeEntityLike, v: TgVideo, file: string, onProgress: (n: number) => void) {
  let have = fs.existsSync(file) ? fs.statSync(file).size : 0;
  if (have > v.size) {
    fs.rmSync(file);
    have = 0;
  }
  if (have === v.size) return;
  const start = Math.floor(have / CHUNK) * CHUNK; // ادامه از آخرین تکه‌ی کامل
  if (start !== have) fs.truncateSync(file, start);
  const free = freeBytes(TMP_DIR);
  if (free < v.size - start + 1024 ** 3) die(`فضای خالی دیسک کافی نیست (${gb(free)} آزاد، ${gb(v.size - start)} لازم + ۱GB حاشیه)`);

  // پیام تازه برای اعتبار fileReference
  const [msg] = await client.getMessages(entity, { ids: v.msgId });
  if (!(msg?.media instanceof Api.MessageMediaDocument)) throw new Error("پیام ویدیو در تلگرام پیدا نشد (حذف شده؟)");
  const fd = fs.openSync(file, start ? "a" : "w");
  let done = start;
  try {
    for await (const chunk of client.iterDownload({
      file: msg.media,
      offset: bigInt(start),
      requestSize: CHUNK,
      limit: Math.ceil((v.size - start) / CHUNK),
      msgData: [entity, v.msgId],
    })) {
      fs.writeSync(fd, chunk);
      done += chunk.length;
      onProgress(done);
    }
  } finally {
    fs.closeSync(fd);
  }
  if (fs.statSync(file).size !== v.size) throw new Error(`دانلود ناقص ماند (${mb(fs.statSync(file).size)} از ${mb(v.size)})`);
}

async function pickChannel(api: ReturnType<typeof arvanApi>, wanted?: string) {
  const list = await api.channels();
  if (wanted) return list.find((c) => c.id === wanted) ?? die(`کانال ${wanted} در آروان پیدا نشد`);
  if (list.length === 1) return list[0];
  if (!list.length) return die("در آروان هیچ کانالی ساخته نشده است");
  console.log("چند کانال در آروان دارید؛ یکی را با ‎--channel مشخص کنید:");
  for (const c of list) console.log(`  ${c.id}  ${c.title}`);
  return die("کانال مشخص نشد");
}

async function runImport(arg: string, o: { includeOut: boolean; limit: number; channel?: string; profile?: string }) {
  takeLock();
  const setting = await db.setting.findUnique({ where: { key: "arvan" } });
  const apiKey = (setting?.value as { apiKey?: string } | null)?.apiKey || die("کلید API آروان را در پنل مدیریت ← تنظیمات وارد کنید");
  const api = arvanApi(apiKey);
  const channel = await pickChannel(api, o.channel);

  const client = await connect();
  let stopping = false;
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.on(sig, () => {
      if (stopping) process.exit(1);
      stopping = true;
      console.log("\n… بعد از ذخیره‌ی وضعیت متوقف می‌شود (اجرای دوباره از همین‌جا ادامه می‌دهد)");
      finish(client, 130);
    });

  const chat = await resolveChat(client, arg);
  const all = await listVideos(client, chat.entity, o.includeOut);
  const list = o.limit ? all.slice(0, o.limit) : all;
  console.log(`\n▶ ${new Date().toLocaleString("fa-IR")} — «${chat.title}» ← کانال آروان «${channel.title}»: ${list.length} ویدیو، ${gb(list.reduce((a, v) => a + v.size, 0))}\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const v of list) {
    const key = `tg:${chat.id}:${v.msgId}`;
    const row = await db.videoImport.upsert({
      where: { sourceKey: key },
      create: { sourceKey: key, title: v.title, fileName: v.fileName, size: v.size },
      update: {},
    });
    if (row.status === "DONE") {
      skipped++;
      continue;
    }
    console.log(`[${v.n}/${all.length}] ${v.title} (${mb(v.size)})`);
    const tmp = path.join(TMP_DIR, `${chat.id}-${v.msgId}${path.extname(v.fileName) || ".mp4"}`);
    try {
      await db.videoImport.update({ where: { id: row.id }, data: { status: "DOWNLOADING", progress: 0, error: null, attempts: { increment: 1 } } });
      await download(client, chat.entity, v, tmp, progress(row.id, "دانلود از تلگرام", v.size));
      if (TTY) process.stdout.write("\n");

      let url = row.uploadUrl;
      let from = url ? await api.offset(url).catch(() => null) : null;
      if (!url || from === null) {
        url = await api.createUpload(channel.id, v.size, v.fileName, v.mime);
        from = 0;
      }
      await db.videoImport.update({ where: { id: row.id }, data: { status: "UPLOADING", progress: 0, uploadUrl: url } });
      const fd = fs.openSync(tmp, "r");
      try {
        await api.upload(
          url,
          (pos, len) => {
            const buf = Buffer.alloc(len);
            fs.readSync(fd, buf, 0, len, pos);
            return buf;
          },
          v.size,
          from,
          progress(row.id, "ارسال به آروان", v.size),
        );
      } finally {
        fs.closeSync(fd);
      }
      if (TTY) process.stdout.write("\n");

      const videoId = await api.createVideo(channel.id, { title: v.title, fileId: fileIdFromUploadUrl(url), profileId: o.profile });
      await db.videoImport.update({ where: { id: row.id }, data: { status: "DONE", progress: 100, arvanVideoId: videoId, uploadUrl: null } });
      fs.rmSync(tmp, { force: true });
      ok++;
      console.log(`   ✔ در آروان ثبت شد (در حال تبدیل کیفیت) — ${videoId}`);
    } catch (e) {
      if (stopping) return;
      failed++;
      const msg = (e as Error).message || String(e);
      if (TTY) process.stdout.write("\n");
      console.error(`   ✖ ${msg}`);
      await db.videoImport.update({ where: { id: row.id }, data: { status: "FAILED", error: msg.slice(0, 500) } }).catch(() => {});
    }
  }
  console.log(`\n■ پایان: ${ok} منتقل شد، ${skipped} از قبل منتقل شده بود، ${failed} خطا.${failed ? " برای تلاش دوباره همان دستور را اجرا کنید." : ""}`);
  if (!failed && ok + skipped === list.length) console.log("همه منتقل شد. حالا «pnpm tg logout» را بزنید و از پنل مدیریت ← «ویدیوهای آروان» هر ویدیو را به مبحثش وصل کنید.");
  await finish(client, failed ? 2 : 0);
}

async function status() {
  const rows = await db.videoImport.findMany({ orderBy: { createdAt: "asc" } });
  const by = (s: string) => rows.filter((r) => r.status === s);
  console.log(`کل: ${rows.length} · منتقل‌شده: ${by("DONE").length} · در جریان: ${by("DOWNLOADING").length + by("UPLOADING").length} · در انتظار: ${by("PENDING").length} · خطا: ${by("FAILED").length}`);
  console.log(`حجم منتقل‌شده: ${gb(by("DONE").reduce((a, r) => a + r.size, 0))} از ${gb(rows.reduce((a, r) => a + r.size, 0))}`);
  for (const r of [...by("DOWNLOADING"), ...by("UPLOADING")]) console.log(`  ⏳ ${r.title} — ${r.status === "DOWNLOADING" ? "دانلود" : "ارسال"} ${r.progress}%`);
  for (const r of by("FAILED")) console.log(`  ✖ ${r.title} — ${r.error}`);
  await finish();
}

// ─── ورودی خط فرمان ───
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(`--${name}`);
const opt = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const chatArg = rest.find((a, i) => !a.startsWith("--") && !["--limit", "--channel", "--profile"].includes(rest[i - 1]));

(async () => {
  switch (cmd) {
    case "login":
      return login();
    case "logout":
      return logout();
    case "chats":
      return chats();
    case "videos":
      return videos(chatArg ?? die("شناسه‌ی گفتگو را بنویسید: pnpm tg videos <chat>"), flag("all"));
    case "import":
      return runImport(chatArg ?? die("شناسه‌ی گفتگو را بنویسید: pnpm tg import <chat>"), {
        includeOut: flag("all"),
        limit: Number(opt("limit") || 0),
        channel: opt("channel"),
        profile: opt("profile"),
      });
    case "status":
      return status();
    default:
      console.log(fs.readFileSync(process.argv[1], "utf8").split("*/")[0].replace(/^\/\*\*\n?/, "").replace(/^ \* ?/gm, ""));
      await finish();
  }
})().catch(async (e) => {
  console.error(`\n✖ ${(e as Error).message || e}`);
  await finish(undefined, 1);
});
