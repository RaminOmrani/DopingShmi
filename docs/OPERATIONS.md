# Operations — server, deploy, backups, local setup

Checked against `deploy/*` at `da72570` (2026-11-08). The AI never has SSH or production access: **the owner runs every
server command himself and pastes the output back.** Give him exact copy-paste commands in Persian, one step at a time,
and say what each does. Never contact `dopingshimi.ir` or the server from your side.

Related: [AGENTS.md](../AGENTS.md) (hard rules) · [ARCHITECTURE.md](ARCHITECTURE.md) · [VIDEO.md](VIDEO.md) (video
diagnosis) · [TESTING.md](TESTING.md).

Contents: 1 Server layout · 2 Safe vs forbidden · 3 Deploy · 4 Verify (doctor.sh) · 5 Rollback · 6 Backups and restore ·
7 Logs and commands · 8 Secrets and admin password · 9 First install / new server · 10 Telegram import ops ·
11 Local development · 12 Seeds and data fixes · 13 Gotchas · 14 Ideas (not implemented) · 15 Admin recipes

---

## 1. Server layout

A **shared** Ubuntu VPS in Sweden. It also hosts other sites (e.g. «ذهن سبز», Zehn Sabz) and services; ports
**3000 and 4310 belong to them**. Planned later: move to an Iranian 4 GB VPS (§9).

| item | location / value |
|---|---|
| Code | `/opt/doping` (git checkout tracking `claude/dazzling-meitner-g7mbwp`) |
| Env file | `/opt/doping/.env` (mode 600). Keys: `DATABASE_URL`, `AUTH_SECRET`, `UPLOAD_DIR`, `SITE_URL`, `PORT`, and `INSECURE_COOKIE="1"` only if installed without a domain. **Values never leave the server.** |
| DB password file | `/var/lib/doping/db.pass` (600) |
| Uploads | `/var/lib/doping/uploads` (WebP images; served by nginx at `/uploads/`) |
| Backups | `/var/lib/doping/backups/db-YYYYMMDD-HHMM.dump` + `uploads-YYYYMMDD-HHMM.tar.gz` |
| Telegram import | `/var/lib/doping/tg-import.log`, `tg-import.pid`, `tg-tmp/` (+ `.lock`), `.telegram-session.json` (deleted by `pnpm tg logout`) |
| App process | pm2 app **`doping`**: `node_modules/next/dist/bin/next start -p $PORT -H 127.0.0.1`, `NODE_ENV=production`, `TZ=Asia/Tehran`, `max_memory_restart: 700M`, `time: true` (`deploy/ecosystem.config.cjs`). Fork mode × 1 instance comes from **pm2 defaults** — the config sets neither `exec_mode` nor `instances`, so never `pm2 scale doping` |
| PORT | from `.env` (`PORT="…"`), default 3200; install.sh picked the first free port ≥ 3200 |
| pm2 daemon | root's pm2, **shared with other apps** (`pm2 save` writes the dump for all of them) |
| pm2 logs | `/root/.pm2/logs/doping-out.log` (console.log) and `doping-error.log` (console.warn/error). No log rotation configured |
| nginx | site **`doping`**: `/etc/nginx/sites-available/doping` + symlink in `sites-enabled/`; certbot added its 443 block to this same file. Access/error logs are the shared defaults in `/var/log/nginx/` |
| TLS | certbot cert `dopingshimi.ir` + `www`, `--redirect`, registered without email; renewed by the Ubuntu certbot timer |
| Postgres | system service `postgresql`, role `doping`, DB `doping`, 127.0.0.1:5432 (the cluster may host other apps' DBs) |
| Cron | root crontab `0 4 * * * /opt/doping/deploy/backup.sh # doping-backup` (04:00 in the *system* TZ) |
| Swap | permanent `/swapfile` 2 G (created only if swap was < 1 GB at install); temporary `/swapfile-doping-build` 3 G during builds |
| Network | BBR enabled in `/etc/sysctl.d/99-bbr.conf` (owner fact, not in repo) |
| DNS / CDN | `dopingshimi.ir` on ArvanCloud (DNS + CDN). Google Search Console verified with a TXT record there |

Data that lives in the DB, not files: everything in the `Setting` table (site texts, SMS, Arvan, payment, points, access
config, incl. API keys and passwords). `getSettings()` caches 15 s per process.

## 2. Shared server: safe vs forbidden

**Safe (scoped to doping):**
- `bash /opt/doping/deploy/update.sh` at a quiet hour; `bash /opt/doping/deploy/doctor.sh` any time; `bash /opt/doping/deploy/backup.sh`.
- `pm2 logs|describe|reload|restart|stop doping` (always with the name).
- `sudo -u postgres psql doping` (DB `doping` only).
- Editing `/opt/doping/.env`, then `pm2 restart doping` (rebuild if a build-time value changed: `SITE_URL`, `NEXT_PUBLIC_*`).
- Editing `/etc/nginx/sites-available/doping`, then `nginx -t && systemctl reload nginx` (**reload, never restart**).
- Read-only: `ss -ltnp`, `pm2 status`, `timedatectl`, `cut -d= -f1 /opt/doping/.env` (key names only).

**Forbidden / ask the owner first:**
- Any other pm2 app; `pm2 restart all`, `delete all`, `kill`, `update`, `flush` without a name; installing pm2 modules
  (e.g. `pm2-logrotate` is global — ask first).
- `killall node` or any `pkill -f …` (a pattern from your own command line kills your shell). Kill by PID only.
- Other nginx sites, other apps' ports (3000, 4310, …), ufw rules (never `ufw enable`/`reset`).
- `systemctl restart nginx|postgresql` (shared services).
- `apt upgrade`, re-running `install.sh` (its `apt-get install` can upgrade/restart shared nginx/postgres),
  **never `do-release-upgrade`**, changing the system timezone.
- Reboot except at a quiet hour with the owner's OK.
- Other databases in the cluster; exposing ports (`prisma studio`, `pnpm dev`, `pnpm start` — they default to 3000).
- Reading Zehn Sabz files or credentials.
- Changing the melipayamak **main account password** (shared with Zehn Sabz).
- Asking the owner to paste keys, passwords, api_id/api_hash or tokens into chat.
- **Running the E2E harness on the server** (`tests/e2e/setup.mjs`, `ctl.sh`, `run.mjs`, `pnpm e2e`). Its DB guard only
  checks for a local host, and the production DB *is* on 127.0.0.1: it would write test users/videos (with `--force` also
  overwrite the Arvan key), and `ctl.sh app` would start a second Next process on the live DB (duplicate hourly cron and
  SMS). The harness refuses when it sees `/opt/doping`, `/var/lib/doping` or the nginx site `doping`; don't rely on that.
- `prisma/seed.ts --demo` on the server (10 demo students, sample topics/videos/exams and 30 days of fake activity that
  pollute the leaderboards). Demo data is for local DBs only.

## 3. Deploy

**Who/when:** the AI changes code locally, verifies, commits and pushes to `claude/dazzling-meitner-g7mbwp` **only when the
owner asks**; the owner runs update.sh **outside study hours** (the build replaces `.next` in place, so the site is down
or 502 for a few minutes, and stays down if the build fails).

1. **AI, locally:** change → `pnpm typecheck` → `pnpm build` (local DB, §11) → E2E if the player/app shell changed
   ([TESTING.md](TESTING.md)) → clear English commit message → push (with the owner's OK). No PRs unless asked.
   If your session works on another branch, fast-forward/merge your commits into `claude/dazzling-meitner-g7mbwp` and push
   that branch; the server never sees other branches.
2. **Owner, backup first:** `bash /opt/doping/deploy/backup.sh` (update.sh runs `db:push` on the live DB; §6).
3. **Owner, on the server** (ideally in `tmux`/`screen`; an SSH drop mid-build leaves `.next` broken — re-run):
   ```bash
   bash /opt/doping/deploy/update.sh
   # or detached:
   nohup bash /opt/doping/deploy/update.sh > /var/lib/doping/update.log 2>&1 &   # then: tail -f /var/lib/doping/update.log
   ```
   If it stops at «⚠️ There might be data loss … Do you want to ignore the warning(s)?», the owner must answer **No**
   (or Ctrl+C) and paste the output to you. Answering yes drops the listed columns/tables with their data (see step 4 below).
4. **Verify** with doctor.sh (§4).

`deploy/update.sh` steps (`set -euo pipefail`, temp swap removed by an EXIT trap):
1. `cd /opt/doping`; `NODE_OPTIONS=--max-old-space-size=1536`.
2. `git pull --ff-only` — fails on detached HEAD, diverged branch or local edits; nothing else changes.
3. `pnpm install --frozen-lockfile` (postinstall → `prisma generate`) — fails if `pnpm-lock.yaml` wasn't committed.
4. `pnpm db:push` — changes the **live DB while the old build still serves**. No `--accept-data-loss`. On a data-loss
   warning Prisma 7 does **not** simply abort: in an interactive terminal (stdin is a TTY and `CI` is unset, i.e. the owner
   running update.sh over SSH) it **asks** «Do you want to ignore the warning(s)?» and a yes applies the destructive change
   (checked in `node_modules/prisma/build/cli.js`). It aborts on its own only when non-interactive (the `nohup … &` form,
   or `CI=1`); unexecutable changes always abort. After an abort the code on disk is new and the build still old.
   (Hardening idea, a code change for the owner to approve: `CI=1 pnpm db:push` in update.sh so it always aborts.)
5. `pnpm db:seed-articles` (no-op after the first run), `pnpm db:fixes` (idempotent).
6. Temporary 3 G swap if MemAvailable + SwapFree < 3500 MB.
7. `nice -n 19 pnpm build` — `next build` deletes `.next` at start (verified in `node_modules/next/dist/build/index.js`
   `cleanDistDir`), so the running server breaks during the build. **A failed build leaves the site down** until fixed or rolled back.
8. Remove temp swap; `pm2 reload doping || pm2 start deploy/ecosystem.config.cjs`; `pm2 save`; prints `git log -1 --oneline`.

update.sh does **not**: touch nginx (template changes must be applied by hand to `/etc/nginx/sites-available/doping`),
re-read `ecosystem.config.cjs` (after changing PORT/memory/TZ: `pm2 delete doping && pm2 start deploy/ecosystem.config.cjs && pm2 save`),
or run `pnpm db:seed`. New SMS template keys don't need it: `ensureTemplates()` (`src/lib/sms/index.ts`) creates missing
`SmsTemplate` rows at runtime (when /admin/sms loads or on the first send, once per process). Bumping `TPL_VERSION` there
rewrites the bodies of **all** templates on the next run, overwriting edits the admin made in /admin/sms.

## 4. Verify a deploy — `deploy/doctor.sh` (read-only, safe any time)

`bash /opt/doping/deploy/doctor.sh` prints: `git log -1` (code on disk) · `.next/BUILD_ID` time · node/pnpm, `free -m`,
`df -h /` · `pm2 status` (all apps) · `pm2 describe doping` (status, restarts, uptime, created at) · `timedatectl`
sync line + `date -u` · listening ports 80/443/3xxx/4310/5432 · nginx enabled sites · postgres active · app HTTP code ·
**`new build live`**: unauthenticated `POST /api/playback-log` → 401 = telemetry build (2021f2b+) running, 404 = old build
(→ `pm2 reload doping`) · `nginx -t`, curl :80 · last 40 doping log lines.

Check: the git line equals the pushed SHA (this is what proves *which* commit is deployed); build time is fresh; pm2
`uptime` started **after** the build time (`created at` may not change on `pm2 reload` — unverified, so prefer uptime);
restarts not climbing; `HTTP 200`; `new build live: yes`; `System clock synchronized: yes` (secure-link expiry depends on it).
`new build live: yes` is necessary but not sufficient: the 401 probe is true for every build from 2021f2b on.
Afterwards `/admin/playback` shows the client `build` per event = what phones actually run.
Privacy: the last 40 log lines can contain user ids/phones and, while SMS is mock, `[sms:mock]` OTP codes. Ask the owner
to paste only the part **above** `=== log (last 40)`; for logs give a filtered grep (e.g. the one in [VIDEO.md §7](VIDEO.md#7-troubleshooting-playbook)).

## 5. Rollback

**Preferred** (keeps branch and server consistent): locally `git revert <bad-sha>` → typecheck/build → push (owner's OK)
→ owner runs update.sh (a revert is a fast-forward). **Never force-push or reset the remote branch** — the server's
`pull --ff-only` would fail; the server-side repair would be `git fetch origin && git reset --hard origin/claude/dazzling-meitner-g7mbwp`,
only with the owner's consent.

**Emergency, on the server, no GitHub change:**
```bash
cd /opt/doping
git reflog --date=iso | head -15        # what was deployed when (HEAD@{1} = before the last pull)
git log --oneline -15                   # pick GOOD_SHA
git checkout GOOD_SHA                   # detached HEAD
export NODE_OPTIONS=--max-old-space-size=1536
pnpm install --frozen-lockfile
# do NOT run `pnpm db:push` here if the bad commit added tables/columns (older schema would try to drop them)
# temp swap like update.sh, so the build can't push other sites into OOM (skip if `free -m` shows ≥ 3.5 GB available+swap):
[ -f /swapfile-doping-build ] || { fallocate -l 3G /swapfile-doping-build && chmod 600 /swapfile-doping-build && mkswap /swapfile-doping-build && swapon /swapfile-doping-build; }
nice -n 19 pnpm build                   # builds in place: the site is down again for a few minutes
swapoff /swapfile-doping-build; rm -f /swapfile-doping-build
pm2 reload doping
bash deploy/doctor.sh
```
Return to normal **only after the revert/fix is on GitHub**: `git checkout claude/dazzling-meitner-g7mbwp && bash deploy/update.sh`
(update.sh can't run from detached HEAD; before the fix is pushed it would pull and rebuild the bad commit again). Code rollback doesn't roll back the DB; additive schema (e.g. the `PlaybackEvent` table from 054359d)
is harmless to older code. Bad data → restore from backup (§6). The service worker never caches panel HTML, so rollbacks are safe for clients.

## 6. Backups and restore

`deploy/backup.sh` (root cron 04:00 system TZ; also run it by hand before risky work):
`sudo -u postgres pg_dump -Fc doping > db-$TS.dump` + `tar -czf uploads-$TS.tar.gz -C /var/lib/doping uploads`; keeps the
**14 newest files of each type** (manual runs shorten the history). Not backed up: `.env`, `db.pass` (losing
`AUTH_SECRET` only logs everyone out). Backups are on the **same server** — suggest the owner copies them off
periodically (`scp` from his PC). **Dumps contain secrets** (Setting API keys, password hashes, phones). A restore has
never been tested.

Restore the DB (keeps the old DB):
```bash
bash /opt/doping/deploy/backup.sh                       # snapshot current state first
pm2 stop doping
sudo -u postgres psql -c 'ALTER DATABASE doping RENAME TO doping_old_YYYYMMDD;'
sudo -u postgres psql -c 'CREATE DATABASE doping OWNER doping;'
sudo -u postgres pg_restore --no-owner --role=doping -d doping /var/lib/doping/backups/db-YYYYMMDD-HHMM.dump
cd /opt/doping && pnpm db:push                          # only if the dump is older than the current (additive) schema
pm2 start doping && bash deploy/doctor.sh
```
Restore uploads:
```bash
mv /var/lib/doping/uploads /var/lib/doping/uploads.bak-$(date +%s)
tar -xzf /var/lib/doping/backups/uploads-YYYYMMDD-HHMM.tar.gz -C /var/lib/doping
```

## 7. Logs and useful commands

pm2 (doping only): `pm2 status`, `pm2 describe doping`, `pm2 logs doping --lines 200 --nostream`,
`pm2 logs doping --err --lines 300 --nostream`, `pm2 reload|restart|stop doping`, `pm2 flush doping` (with the name).

Log lines worth grepping (`-a` because of Persian text):

| line | file | meaning |
|---|---|---|
| `[video-error] {…}` | doping-error.log | loud telemetry kinds + legacy error route ([VIDEO.md §5](VIDEO.md#5-telemetry)) |
| `[play] fresh {…}` | doping-error.log | player asked for a fresh link; `throttled`, `ms` |
| `arvan` / `arvan (fresh, Nms)` + error | doping-error.log | Arvan API call failed → 502 to the player |
| `[arvan] clock skew Ns …` / `[arvan] signed expiry differs …` | doping-error.log | server clock vs Arvan; expiry mismatch |
| `[playback-log] db error` | doping-error.log | telemetry insert failing |
| `[cron]` | doping-error.log | hourly job error |
| `[sms:mock] …` | doping-out.log | while SMS provider = mock, **OTP codes appear here** (sensitive; also how an admin can get an OTP before SMS works) |

Example: `grep -a '\[video-error\]' /root/.pm2/logs/doping-error.log | tail -50`. Log size: `ls -lh /root/.pm2/logs/`.

psql (peer auth; no need to read `.env`): `sudo -u postgres psql doping`. Tables are quoted PascalCase:
```sql
SELECT kind, count(*) FROM "PlaybackEvent" WHERE "createdAt" > now() - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC;
SELECT build, count(*) FROM "PlaybackEvent" WHERE "createdAt" > now() - interval '1 day' GROUP BY 1;
SELECT status, count(*) FROM "VideoImport" GROUP BY 1;
SELECT key, "updatedAt" FROM "Setting";          -- keys only; NEVER select "value" (contains secrets)
SELECT phone, role FROM "User" WHERE role <> 'USER';
```

## 8. Secrets and the admin password

- Service secrets (melipayamak API key/password, Arvan API key, Zarinpal merchantId) are entered by the owner in
  Admin → «تنظیمات» and stored in `Setting`. Never ask him to paste them in chat. Masked with blank-keeps-value: SMS
  password and apiKey, Arvan apiKey (`saveSms`, `saveArvan`). **Not** masked: the Zarinpal merchantId is shown in clear and
  saving the form with it blank **clears** it (`savePayment`); the SMS username and sender line also clear when blank.
- Server-only secrets: `.env` values, `db.pass`, the Telegram session file. Show key names only (`cut -d= -f1`).
- Role STAFF («پشتیبان») counts as admin everywhere (`isAdmin` in `src/lib/auth.ts`), including the settings page with
  service keys and payment approval: grant it only to people trusted with those.
- Admin account: phone 09158148172, initial password = the seed default documented in README (owner was told how to change/reset it; it must be changed in production).
  `ADMIN_PASSWORD=… pnpm db:seed` does **not** reset an existing admin.
- Reset without putting the password in chat or shell history — the owner types it:
  ```bash
  read -rsp 'New password: ' P; echo
  H=$(P="$P" node -e 'const c=require("crypto");const s=c.randomBytes(16).toString("hex");console.log(s+":"+c.scryptSync(process.env.P,s,64).toString("hex"))'); unset P
  sudo -u postgres psql doping -c "UPDATE \"User\" SET \"passwordHash\"='$H' WHERE phone='09158148172';"; unset H
  ```
  (format = `hashPassword()` in `src/lib/auth.ts`: `salt:hex(scrypt 64)`). The snippet doesn't check length; tell the owner
  to use at least 8 characters (the admin «تغییر رمز» form requires 8). Alternative: «فراموشی رمز» at `/login` with an OTP
  (while SMS is mock, read it from the `[sms:mock]` log line).

## 9. First install / new server — `deploy/install.sh`

Run as root: `bash install.sh dopingshimi.ir` (or without a domain → http://IP). Env: `BRANCH` (default
`claude/dazzling-meitner-g7mbwp`), `GITHUB_TOKEN` (optional for a private repo; ends up in plain text in
`/opt/doping/.git/config` and shell history). It:
- aborts if `/opt/doping` is another repo, port 80 is held by non-nginx, or 5432 by a non-system Postgres;
- apt-installs curl git nginx postgresql openssl (+ Node 22 via nodesource if node < 20), `pnpm@10`, `pm2`;
- creates role/DB if missing, clones the branch, writes `.env` **only if absent** (random DB password/AUTH_SECRET,
  `UPLOAD_DIR`, `SITE_URL`, `INSECURE_COOKIE` without domain, first free `PORT` ≥ 3200);
- `pnpm install --frozen-lockfile`, `db:push`, `db:seed`, build with temp swap + `nice`, `pm2 start` + `save` + `startup`;
- writes its nginx site only if it isn't already certbot-managed; `nginx -t` failure removes only its own symlink;
- touches ufw only if already active (`ufw allow 'Nginx Full'`) — README's "firewall" claim overstates this;
- certbot (domain only), backup cron (de-duplicated); prints the admin login **including the seed default password in
  clear text** (terminal scrollback).

**Do not re-run install.sh on the shared server** — use update.sh.

Move to the Iranian 4 GB VPS (planned): install.sh there → restore the latest dump + uploads (§6) → optionally copy
`AUTH_SECRET` so sessions survive → `SITE_URL=https://dopingshimi.ir` → switch the A record in Arvan DNS. Arvan/SMS keys
travel inside the DB.

## 10. Telegram import ops

Done for the first 53 videos; session logged out. Reuse: `cd /opt/doping && pnpm tg login` (owner types credentials
interactively) → `pnpm tg chats` → `bash deploy/tg-import.sh <chat> --stream --parallel 4` → `bash deploy/tg-import.sh log`
→ `pnpm tg status` → **`pnpm tg logout`** when finished. Details: [VIDEO.md §9](VIDEO.md#9-telegram--arvan-import-scriptstgts).

## 11. Local development (from scratch)

1. Node ≥ 20.9 (Next 16 minimum; server uses 22), pnpm 10, PostgreSQL.
2. `git clone https://github.com/RaminOmrani/DopingShmi.git && cd DopingShmi` (the only branch is checked out by default).
3. `pnpm install` (postinstall generates the Prisma client into `src/generated/prisma`).
4. Local DB matching `.env.example`, e.g. `sudo -u postgres psql -c "CREATE USER doping WITH PASSWORD 'doping';" -c "CREATE DATABASE doping OWNER doping;"`.
5. `cp .env.example .env`; set `DATABASE_URL`; optional `SITE_URL=http://localhost:3000`; `INSECURE_COOKIE=1` only for a
   production build served over plain http on a non-localhost host. (The E2E harness doesn't need it: `lib.js` injects
   its own `ds_session` cookie with `secure: false`.) A local `.env` is required; only the *production* values stay on the server.
6. `pnpm db:push`, `pnpm db:seed`, demo data: `pnpm exec tsx prisma/seed.ts --demo` (**not** `pnpm db:seed -- --demo`, §12).
7. `pnpm dev` → http://localhost:3000. SMS is mock: the OTP comes back as `devCode` in a toast. Admin 09158148172 (seed
   default password), demo student 09150001000. Uploaded images don't render in dev (no `/uploads` route).
8. Checks: on a fresh clone run `pnpm exec next typegen` (or one `pnpm build`) before `pnpm typecheck` — `next-env.d.ts`
   and `.next/types` are generated and gitignored. `pnpm build` needs the DB reachable and pushed (root metadata reads `Setting`).
9. Video locally: there is no real Arvan key — use the E2E harness (`tests/e2e`, mock Arvan API + CDN) — [TESTING.md](TESTING.md).

## 12. Seeds and data fixes

- `prisma/seed.ts` (first part of `pnpm db:seed`): admin if missing (`ADMIN_PHONE` default 09158148172, `ADMIN_PASSWORD`
  default = README's; promotes an existing non-admin phone; prints phone/password — don't pass the password inline),
  upserts SmsTemplate rows (never overwrites), chapter topics per grade at price 390000 only if there are none, 4 sample
  class groups only if none. `--demo`: 10 demo students `09150001000…09150001009` (7 approved, 2 pending), 4 videos per G12
  topic, a bundle, 5 exams with results, 30 days of activity/progress. **`--demo` is for local DBs only — never on the server.**
- **Bug (verified with pnpm 10): `pnpm db:seed -- --demo` does not create demo data** — pnpm appends extra args to the
  last command of the `&&` chain (`seed-articles.ts`). Correct: `pnpm exec tsx prisma/seed.ts --demo && pnpm db:seed-articles`.
  (The header comment in `prisma/seed.ts` still shows the wrong form.)
- `prisma/seed-articles.ts`: draft articles once per marker (v1: 2 drafts, guard `Setting seed:articles`; v2: 2 SEO drafts,
  guard `Setting seed:articles:v2`, skipped if the slug exists); runs on every update, no-op once both markers exist. Drafts
  stay unpublished until the owner publishes them in Admin → مقالات.
- `prisma/data-fixes.ts`: runs on every update; must stay idempotent. Currently rewrites «لیسانس مهندسی شیمی» →
  «کارشناسی ارشد مهندسی شیمی» in `Setting site` (the teacher's degree). Put future one-off data migrations here.

## 13. Gotchas

- **Next 16.3.6**: `next dev` upserts the managed block at the top of `AGENTS.md`; content outside the markers is kept —
  commit the block. Turbopack is default (`/*turbopackIgnore: true*/` on dynamic paths in `upload.ts`). `next build` wipes
  `.next` at start; dev output goes to `.next/dev`. No `next lint`. Async request APIs. No middleware/proxy file — auth per page.
- **Single process**: the hourly cron (`instrumentation.ts`), link cache, rate limiters and telemetry quotas live in
  memory. Never switch pm2 to cluster/multiple instances (duplicated cron and SMS reminders).
- **Build resources**: ~1.8 GB RAM; `NODE_OPTIONS=--max-old-space-size=1536`, `nice -n 19`, temp 3 G swap so other sites
  aren't OOM-killed. pm2 restarts the app above 700 MB RSS (watch `restarts` in doctor).
- **Prisma 7**: import from `@/generated/prisma/client`; the pg driver adapter is mandatory; datasource URL is in
  `prisma.config.ts`; scripts create their own client with the adapter. No migrations — `db push`. Keep schema changes
  **additive** (new tables, nullable/defaulted columns). A rename is drop + add = data loss: do add → copy in
  `data-fixes.ts` → drop later, with the owner's OK.
- **pnpm 10**: server uses `--frozen-lockfile` → always commit `pnpm-lock.yaml`; deps with install scripts must be listed in
  `pnpm.onlyBuiltDependencies`.
- **Service worker**: bump `VERSION` in `public/sw.js` (now `ds-v3`) when caching changes.
- **Client IP behind the Arvan CDN**: nginx sets `X-Real-IP $remote_addr` with no real_ip config → likely the edge IP.
  Telemetry prefers `ar-real-ip`; `clientIp()` doesn't → keep `arvan.bindIp` off; per-IP login limits may be shared by many users.
- **Clock**: secure-link expiry uses the server clock; doctor shows sync; the app logs `[arvan] clock skew`.
- **SITE_URL / INSECURE_COOKIE**: if the box was ever installed without a domain, `.env` may have `SITE_URL=http://IP`
  (must be `https://dopingshimi.ir` for SEO and the payment callback; rebuild after fixing) and `INSECURE_COOKIE` (drops
  the Secure flag on HTTPS). Check presence only: `grep -c INSECURE_COOKIE /opt/doping/.env`.
- **Sessions**: JWT cookie `ds_session`, 60 days; changing `AUTH_SECRET` logs everyone out.
- **assetlinks.json**: README tells the owner to drop `public/.well-known/assetlinks.json` on the server; better to commit
  it, or a later `git pull` can conflict with the untracked file.
- **Never `pnpm dev`/`pnpm start` on the server** (port 3000 = another app).
- **Never run the app (dev, start or E2E) against a copy of the production DB** (e.g. a restored dump). The hourly cron in
  `src/instrumentation.ts` starts in every `next dev`/`next start` process and would send real `sub_expiring` SMS with the
  stored melipayamak key; Arvan calls would use the real key. If you must, first blank the secrets in `Setting` `sms` and
  `arvan` and set the SMS provider to `mock` in that copy.

## 14. Ideas (not implemented — owner decision)

- Build into a separate directory/checkout and swap atomically (removes the build-time outage and the broken-site risk).
- Run update.sh under nohup/tmux by default.
- Off-site backup copy; test a restore once.
- pm2 log rotation (global — ask first); per-site nginx `access_log`; certbot registration email.

## 15. Admin recipes (owner tasks in the admin panel; no deploy needed)

Settings changes apply within the 15 s settings cache.

- **New paid topic with Arvan videos, one of them free.** Arvan conversion must be finished (duration 0 → edit later).
  1. `/admin/topics` → new topic: title, grade, majors, price in toman **> 0**, published (`saveTopic`). Price 0 = no
     single sale («فروش تکی این مبحث فعال نیست»); the topic is then sold only inside a bundle.
  2. `/admin/arvan-videos` → for each unlinked video: topic, title, «نمایش», «رایگان» on the free one, «افزودن»
     (`attachArvanVideo`). This path sends **no** new-video notification. Alternative: the video form on
     `/admin/topics/[id]` (`saveVideo`, Arvan id) is the only path with «پیامک ویدیو جدید» (in-app + `video_new` SMS).
  3. Optional: `/admin/bundles`. Sales: card-to-card → `/admin/payments` → approve.
  - A «رایگان» video still requires login (`/courses/[id]` links to `/login?next=…`). Approved class students see every
    topic while `access.studentsAllGrades` is on (the default). Don't clear the Telegram import report before all 53
    videos are attached (it holds their order; [VIDEO.md §8](VIDEO.md#8-admin-pages-for-video)).
- **Points per 5 minutes of watching:** «تنظیمات» → «امتیازدهی» → «هر ۵ دقیقه تماشا» (`points.videoPer5Min`, default 1,
  0 disables). Not retroactive. The 300 s block itself is hardcoded (see [VIDEO.md §2.4](VIDEO.md#24-post-apivideosidprogress)).
- **Student names in the leaderboard:** «تنظیمات» → «دسترسی شاگردان» → «دانش‌آموزان نام یکدیگر را در رتبه‌بندی ببینند»
  (`access.showStudentNames`, default off). Admins always see names.
- **SMS setup (melipayamak)**, all in the panel, never in chat:
  1. «تنظیمات» → «پیامک — ملی‌پیامک»: choose the provider (`melipayamak-console` = API key only; `melipayamak-rest` =
     web-service username + «رمز / ApiKey وب‌سرویس»), enter the key and the sender line («شماره خط فرستنده»), keep «استفاده از
     الگوها (خدماتی)» on, press «ذخیره و بررسی اعتبار» (it shows the panel credit or the error).
  2. In the melipayamak panel, whitelist the server's IP (error -109 = IP not allowed).
  3. «ارسال آزمایشی» in the same section.
  4. `/admin/sms` → enter the approved pattern code (bodyId) for each re-registered template. The panel value wins;
     `MELIPAYAMAK_BODY_IDS` in code only fills empty codes and needs a deploy. Templates without a code go out inside the
     approved `general` pattern (545226).
