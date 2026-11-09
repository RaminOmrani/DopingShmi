// آماده‌سازی پایگاه داده‌ی «محلی» برای تست E2E و ساخت توکن ورود (JWT) دانش‌آموزان/مدیر تست.
// Prepares the LOCAL dev database for the E2E harness and mints session JWTs (gitignored, tests/e2e/.run/).
//   node tests/e2e/setup.mjs            create/update test rows + mint JWTs (idempotent, re-run any time)
//   node tests/e2e/setup.mjs --force    also overwrite a non-test Arvan key in the local Setting 'arvan'
//   node tests/e2e/setup.mjs --clean    delete every E2E row (users e2eu…, videos e2evid…, their telemetry)
// Needs a seeded DB: `pnpm db:push && pnpm exec tsx prisma/seed.ts --demo` (demo student 09150001000, admin 09158148172).
// It refuses to run against a non-local DATABASE_URL and never prints secrets.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const L = require("./lib.js");
const args = new Set(process.argv.slice(2));
const USERS = 20; // scenario slots n = 1..20 (see lib.js ids())
const DEMO_PHONE = process.env.E2E_DEMO_PHONE || "09150001000";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "09158148172";
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const die = (msg) => {
  console.error(`setup: ${msg}`);
  process.exit(1);
};

try {
  L.db("select 1");
} catch (e) {
  die(`${e.message}\n  → is PostgreSQL running? (service postgresql start)`);
}

if (args.has("--clean")) {
  L.db(`delete from "PlaybackEvent" where "userId" like 'e2eu%' or "videoId" like 'e2evid%' or "sessionId" like 'apitest-%' or "sessionId" like 'e2e%'`);
  L.db(`delete from "User" where id like 'e2eu%'`);
  L.db(`delete from "Video" where id like 'e2evid%'`);
  L.db(`update "Setting" set value = jsonb_set(value::jsonb, '{apiKey}', '""')::json, "updatedAt" = now() where key = 'arvan' and value->>'apiKey' = 'test-key'`);
  fs.rmSync(path.join(L.RUN, "jwt"), { recursive: true, force: true });
  fs.rmSync(L.jwtFile("admin"), { force: true });
  console.log("setup: E2E rows and JWTs removed");
  process.exit(0);
}

// ─── base data from the seed ───
const demo = L.db(`select id, coalesce(grade,'G12'), coalesce(major,'TAJROBI') from "User" where phone = ${q(DEMO_PHONE)}`);
if (!demo) die(`demo student ${DEMO_PHONE} not found — run: pnpm exec tsx prisma/seed.ts --demo`);
const [, grade, major] = demo.split("|");
const admin = L.db(`select id from "User" where phone = ${q(ADMIN_PHONE)} and role = 'ADMIN'`) || L.db(`select id from "User" where role = 'ADMIN' order by "createdAt" limit 1`);
if (!admin) die("no ADMIN user — run: pnpm db:seed");
const topic = L.db(`select id from "Topic" where grade = ${q(grade)} order by "order" limit 1`) || L.db(`select id from "Topic" order by grade, "order" limit 1`);
if (!topic) die("no Topic rows — run: pnpm db:seed");

// ─── Arvan settings → mock (apiKey "test-key" is what servers.js accepts) ───
const curKey = L.db(`select coalesce(value->>'apiKey','') from "Setting" where key = 'arvan'`);
if (curKey && curKey !== "test-key" && !args.has("--force")) die("the local Setting 'arvan' holds a non-test apiKey; refusing to overwrite it (use --force on a throwaway dev DB)");
L.db(
  `insert into "Setting"(key, value, "updatedAt") values ('arvan', '{"apiKey":"test-key","secureLink":true,"bindIp":false,"expireMinutes":360,"watermark":true}', now())
   on conflict (key) do update set value = excluded.value, "updatedAt" = now()`,
);

// ─── legacy video (mock namespace "") + one student and one video per scenario slot ───
L.db(
  `insert into "Video"(id, "topicId", title, "arvanVideoId", "durationSec", "isFree", "order", published, "createdAt")
   values ('${L.LEGACY_VIDEO_ID}', ${q(topic)}, 'E2E تست پخش', 'vid-test', 150, true, 99, true, now())
   on conflict (id) do update set "topicId" = excluded."topicId", "arvanVideoId" = 'vid-test', "isFree" = true, "durationSec" = 150, published = true`,
);
const rows = [];
for (let n = 1; n <= USERS; n++) {
  const { userId, videoId, ns } = L.ids(n);
  const phone = `0915900${String(n).padStart(4, "0")}`;
  rows.push(
    `insert into "User"(id, phone, name, role, grade, major, "profileDone", "createdAt", "updatedAt")
       values ('${userId}', '${phone}', 'تست ${n}', 'USER', ${q(grade)}, ${q(major)}, true, now(), now())
       on conflict (id) do update set grade = excluded.grade, major = excluded.major, blocked = false, role = 'USER', "profileDone" = true`,
    `insert into "Video"(id, "topicId", title, "arvanVideoId", "durationSec", "isFree", "order", published, "createdAt")
       values ('${videoId}', ${q(topic)}, 'E2E ns ${n}', 'vid-${ns}', 150, true, ${100 + n}, true, now())
       on conflict (id) do update set "topicId" = excluded."topicId", "arvanVideoId" = excluded."arvanVideoId", published = true, "isFree" = true`,
  );
}
L.db(`begin; ${rows.join(";\n")}; commit;`);
const nUsers = L.db(`select count(*) from "User" where id like 'e2eu%'`);
const nVideos = L.db(`select count(*) from "Video" where id like 'e2evid%'`);

// ─── JWTs (same format as src/lib/auth.ts: HS256, sub = user id) ───
const env = L.readEnv();
let secret = process.env.AUTH_SECRET || env.AUTH_SECRET;
if (!secret) secret = L.db(`select value #>> '{}' from "Setting" where key = 'auth.secret'`); // app fallback when .env has none
if (!secret) die("no AUTH_SECRET in .env and no Setting 'auth.secret' — start the app once or set AUTH_SECRET");
let jose;
try {
  jose = await import(pathToFileURL(require.resolve("jose", { paths: [L.REPO] })).href);
} catch {
  die("cannot load 'jose' from the repo — run pnpm install in the repo root");
}
const key = new TextEncoder().encode(secret);
const mint = (sub) => new jose.SignJWT({ sub }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key);
fs.mkdirSync(path.join(L.RUN, "jwt"), { recursive: true });
const write = (f, v) => fs.writeFileSync(f, v, { mode: 0o600 });
for (let n = 1; n <= USERS; n++) write(L.jwtFile(L.ids(n).userId), await mint(L.ids(n).userId));
write(L.jwtFile("admin"), await mint(admin));

console.log(`setup: ok — ${nUsers} test students (09159000001…), ${nVideos} test videos in topic ${topic}, Setting 'arvan' → mock key`);
console.log(`setup: JWTs (valid 7 days) in ${path.relative(L.REPO, L.RUN)}/ — re-run this script when they expire`);
