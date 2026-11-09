# History, decisions and unverified assumptions

Snapshot 2026-11-08 (1405/8/17). Repo `RaminOmrani/DopingShmi`, single branch `claude/dazzling-meitner-g7mbwp`, HEAD
`da72570`, 26 commits (2026-09-27 → 2026-10-28). All commits are authored "Ramin Omrani" with Claude co-author trailers
(AI-written). The first 7 subjects are Persian, the rest English. Five commits share the timestamp 2026-10-28 02:20
(committed/rebased as one batch). Dates below are UTC with the Persian date in brackets; Tehran is UTC+3:30.

Tags: **(code)** checked in the repo · **(owner)** fact from the owner's work sessions, not visible in code, authoritative ·
**(inferred)** reasoning, not confirmed.

Related: [AGENTS.md](../AGENTS.md) · [VIDEO.md](VIDEO.md) · [OPERATIONS.md](OPERATIONS.md) · [TODO.md](TODO.md).

## 1. Changelog

### 2026-09-27 [1405/7/5] — initial build and shared-server safety

| commit | summary |
|---|---|
| `ef78208` | «دوپینگ شیمی: سایت سینمایی، اپ PWA، پنل دانش‌آموز و پنل مدیریت» — public site (hero, conference strip, bio, ranks, topics, gallery, contact), SMS OTP login, profile with grade/major/city, class-student approval, student panel (stats, element levels H→Au, points, streaks, charts), Arvan secure-link videos + phone watermark, internal + «پلکان» exams (Excel import), Zarinpal sales, SMS notices, admin panel, PWA (SW v1), deploy scripts, seed admin 09158148172. Arvan `expireMinutes` default 180 |
| `7f9ae91` | Safe install on the shared server: free port ≥ 3200 (3000/4310 are Zehn Sabz's) written once to `.env`; ecosystem reads PORT; install.sh refuses a foreign `/opt/doping`, non-nginx port 80, non-system Postgres; writes only its own nginx site; ufw only if active; doesn't overwrite a certbot-managed file |
| `661e781` | Build with temporary 3 G swap + `nice -n 19` + `--max-old-space-size=1536` so the OOM killer can't hit other sites |
| `5d3600b` | Card-to-card payment with admin approval; one-to-one private class with SMS; slots for melipayamak pattern codes |
| `ab4630a` | Approved melipayamak body IDs in `MELIPAYAMAK_BODY_IDS`; templates without a code go through the approved `general` pattern; all links removed from SMS texts (rejected without «اینماد») |
| `fbb5800` | Phone + password login/sign-up; SMS only for forgot-password or optional OTP login; per-IP/phone limits |
| `67ccd49` | Light mode + theme toggle |

### 2026-09-28 [1405/7/6]

| commit | summary |
|---|---|
| `44b457d` | New «Dp» element-style logo (`public/brand/*.svg`), regenerated app icons (`scripts/make-logo.mjs`, `make-icons.ts`) |

### 2026-09-29 [1405/7/7] and 2026-10-03 [1405/7/11] — SEO

| commit | summary |
|---|---|
| `aaf91d8` | Root `generateMetadata` (title template, canonical, OG `public/og.png`, verification codes in admin), `robots.ts`, `sitemap.ts`, JSON-LD helpers (`src/lib/seo.ts`), `/javad-partovi`, `/tadris-shimi`, articles module (list, `[slug]`, admin CRUD, 2 seeded drafts), `adminAction` rethrows redirect/notFound, inline SW registration, `docs/TODO.md` created |
| `cd945b6` | `/shimi-konkur`, `/shimi-dahom`, `/shimi-yazdahom`, `/shimi-davazdahom` (`GradeLanding`, `syllabus.ts`), brand FAQ with FAQPage markup on home, keywords «شیمی کنکور». **Degree fix**: «لیسانس» → «کارشناسی ارشد مهندسی شیمی» in defaults + idempotent `prisma/data-fixes.ts` (`pnpm db:fixes`, run by update.sh) |

(owner) Google Search Console verified via TXT in Arvan DNS; sitemap submitted as a full URL; decided to stay on Arvan
(no SEO difference vs Cloudflare).

### 2026-10-13 [1405/7/21] — Telegram → Arvan import

| commit | summary |
|---|---|
| `a98eaba` | `scripts/tg.ts` (GramJS MTProto user login on the server), `VideoImport` table, `deploy/tg-import.sh`, framework-free `src/lib/arvan-api.ts` (TUS upload, `ARVAN_API_BASE`), `/admin/arvan-videos` (attach to topic, title sync, live progress) |
| `dbcf04f` | Live speed + ETA; TUS chunks 8 MB (was 32) |
| `fa4a81f` | 16 MB segments × 4 in flight, `.parts` resume, `--parallel N` (default 2, max 4), list sorted by chat order |
| `7e7c7ff` | TUS offset re-check retried instead of restarting uploads from zero |
| `3f26edb` | `--stream` diskless mode, parallel up to 10 (Arvan caps ~0.5 MB/s per upload connection) |
| `cbecd5d` | `arvanTitle()` pads titles < 5 chars (Arvan rejects them); field errors surfaced; reruns retry only failed rows |
| `684d477` | TODO update |

(owner) All 53 videos (~38 GB) transferred that day with `--stream --parallel` (creating a Telegram api_id at
my.telegram.org did not work from Iran, so a reuse needs api_id/api_hash supplied by the owner on the server, never in
chat); Telegram session logged out afterwards (`pnpm tg logout`).

### 2026-10-26 [1405/8/4] — video reliability, rounds 1–3
Trigger: students reported a black screen mid-video and being kicked out.

| commit | summary |
|---|---|
| `62136f9` | Cause: cached secure link handed out half-expired and never refreshed; no native-HLS error handling; a fatal hls.js error unmounted `<video>`. Fix: hls.js preferred everywhere, network/media recovery, `?fresh=1` on 401/403/410 or manifest failure resuming at the same second, native error handling + stall watchdog, `<video>` stays mounted, quality menu (`ds-quality`). Server: cache keeps real expiry, per-user fresh limiter, `expiresAt` in the response, cache cleared on settings save, default lifetime 180 → 360 min, `[video-error]` logging. Leaderboard hides other students' names unless `access.showStudentNames` |
| `e5e7e67` | After a first E2E harness run + 4 review passes: deadline from `serverNow` (phone clock skew harmless), spaced refreshes with 15 s timeout, resume from the real position, pause + exit fullscreen on give-up, never write progress 0, native watchdog 40 s; server mint dedupe 10 s per video, not-ready answers not cached, min lifetime 60 min; admins always see names |
| `d973169` | «در حال اتصال دوباره» badge after 4 s, manual quality → auto after 15 s stall, refresh budget only until 20 s good playback, cause-based messages, native fallback on incompatible codecs, `AbortSignal.timeout` replacement for old Safari, inflight coalescing, only HLS links cached |

### 2026-10-27/28 [1405/8/5–6] — round 4: "stops after 2–3 minutes / kicks students out"
(owner) A 35-agent investigation found: (1) **reproduced** a silent hung segment download freezing hls.js ~100 s (forward
buffer ~120 s, so it surfaces at ~2 min); (2) iPhone home-screen PWA + hls.js ManagedMediaSource doesn't keep the screen
awake → auto-lock = black screen, relaunch = thrown out; (3) recovery depended on the international `/api` path and gave
up while the Arvan link was still valid; a CORS-less 403 looked like status 0; (4) a manual quality above link speed
stuttered forever; (5) zero telemetry.

| commit | summary |
|---|---|
| `054359d` | `PlaybackEvent` model; client reporter `src/lib/playback-log.ts` (queue, beacon), watch marker `ds-watch` + Web Lock, build stamp `NEXT_PUBLIC_BUILD_SHA` |
| `83c18bf` | `requireAdmin()` at the top of every admin page (layouts don't re-run on client RSC navigation) |
| `f03ae98` | API `private, no-store` + `Vary: Cookie`; `award()` pre-check (no failing unique INSERT spam); fresh limiter set only after Arvan succeeds; `[arvan] clock skew`, `[arvan] signed expiry differs`, `[play] fresh` logs |
| `f312e1c` | Persian error boundaries (one reload on chunk errors), no pull-to-refresh in panel, BottomNav hidden in landscape on the watch page, grain only on public pages, SW `ds-v3` (never stale private HTML, static `offline.html`, logout clears page caches), `WatchMarker`, `InAppHint` |
| `2021f2b` | `/api/playback-log` + `src/lib/playback-store.ts` (quotas, eid dedupe, IP prefix, platform), `/admin/playback` «گزارش پخش ویدیو» + kinds legend, legacy error route stores events, 30-day retention cron, doctor.sh "new build live" + commit/build/clock, update.sh prints the commit |
| `da72570` | Main player fix (~1200 changed lines, split into `player/*.ts`): hls watchdog with byte-progress hung-download detection + escalation ladder; iOS home-screen → native HLS + Screen Wake Lock (`ds-engine` override); refresh resilience (rebuild on the still-valid link, spare/background refresh, 4xx/status-0 triggers refresh, delays 0/16/32 s); deferred give-up + auto-retry 30/60/120 s; quality demotion; buffers 30/60/30; progress give-back on failed POST; support code; `session-end` summaries |

### 2026-11-08 [1405/8/17] — handoff (this documentation set)
- E2E harness ported from the scratchpad into `tests/e2e/` (+ `pnpm e2e`; root `tsconfig.json` excludes `tests/e2e`).
  Re-run after the port: hung-fragment, always403, b-long, wake-lock, pwa-relaunch, frozen-a, outage — all pass.
- Docs: `AGENTS.md` handoff section, `docs/{ARCHITECTURE,VIDEO,OPERATIONS,HISTORY,TESTING}.md`, `docs/TODO.md` update,
  README pointer. Corrected the demo-seed command in README and the harness hints. The harness now refuses to run on
  the production server; playwright pinned to 1.63.0; root `.gitignore` ignores every `.env*` except `.env.example`.
- Security: fixed the login `?next=` open redirect (`sameSitePath()` in `src/app/(auth)/login/LoginForm.tsx`).

### Outside git (owner)
BBR enabled (`/etc/sysctl.d/99-bbr.conf`); Arvan Growth plan, channel «doping shimi»; GSC verified + sitemap; 53 videos
imported then Telegram logout. **Unknown whether the owner has run update.sh since da72570.**

## 2. Decision log

| # | decision | reason | alternatives not taken |
|---|---|---|---|
| 1 | Self-hosted Next 16 + Prisma 7 + PostgreSQL on the owner's existing VPS, pm2 fork × 1 behind nginx | owner already has the VPS; Iranian audience; control | managed hosting (inferred: reachability from Iran, cost) |
| 2 | Videos on Arvan VOD with signed links; no video on the VPS | disk/bandwidth; Iranian CDN | self-hosted HLS |
| 3 | Service secrets + business config in DB `Setting`, edited in admin; `.env` only infra values | owner is non-technical; never paste keys in chat; nothing secret in git | keys in `.env`/repo |
| 4 | Shared-server safety in install/update (free port, own nginx file, ufw only if active, swap + nice) | the VPS hosts Zehn Sabz and others; an OOM/nginx error must not take them down | Docker / separate server (an Iranian 4 GB VPS is planned) |
| 5 | Single branch `claude/dazzling-meitner-g7mbwp` = production source; no main; no PRs unless asked | server tracks it; install.sh default | main + PR flow |
| 6 | Build in place on the server | simple; RAM limits | blue/green; cost = brief outage → deploy outside study hours |
| 7 | Phone + password login; SMS only for reset / optional OTP | SMS not configured yet, template codes pending | OTP-only (original design) |
| 8 | Card-to-card with manual approval; Zarinpal after «اینماد» | Zarinpal needs enamad | gateway now |
| 9 | No links in SMS; uncoded templates via the `general` pattern | melipayamak rejects links without enamad | plain sends |
| 10 | «پلکان» results via Excel/CSV import or manual entry | Palkan has no API | integration |
| 11 | Data corrections in idempotent `prisma/data-fixes.ts` run by every update | owner runs commands himself; safe to repeat | manual SQL in production |
| 12 | SEO landing pages per search intent, JSON-LD, articles, brand FAQ; stay on Arvan DNS/CDN | rank for brand, teacher name, «شیمی کنکور»; Cloudflare = no SEO gain | Cloudflare |
| 13 | Server-side Telegram import (GramJS user login, resumable TUS, `--stream`, `--parallel`) | ~38 GB in the owner's Telegram PV; slow Iranian internet; Arvan ~0.5 MB/s per connection | manual download/upload; Bot API (inferred: size limits) |
| 14 | Keep `<video>` mounted; hls.js everywhere except iOS home-screen PWA → native | control/recovery; MMS doesn't keep the screen awake in standalone (WebKit FB17984089, hls.js #6725) | native everywhere on iOS |
| 15 | Screen Wake Lock while the student wants playback | auto-lock black screens | — |
| 16 | Link cache per video (+IP if bindIp), real expiry, fresh 15 s/user/video, mint dedupe 10 s/video, `serverNow`, lifetime min 60 / default 360 | fewer Arvan calls; no thundering herd after outages; phone clock skew | per-user links (watermark is the per-user deterrent) |
| 17 | `bindIp` off | behind the CDN `X-Real-IP` is the edge IP; mobile IPs change | IP-bound links |
| 18 | Own byte-progress watchdog (10 s idle) | hls.js waits up to ~120 s with no error | tuning hls.js timeouts only (kills slow-but-healthy downloads) |
| 19 | Buffers 30/60 fwd, 30 back | problems surfaced late; phone memory | hls.js defaults |
| 20 | Demote a manual quality to auto after stalls | a too-heavy manual level stuttered forever | always respect the choice |
| 21 | First-party telemetry (`PlaybackEvent`, `/admin/playback` in Persian, 30-day retention, quotas, IP prefix only) | AI never sees production logs; owner non-technical; privacy; no new deps | third-party monitoring (inferred: reachability, deps) |
| 22 | API responses `private, no-store` + `Vary: Cookie` | a CDN rule could cache a signed link | — |
| 23 | `requireAdmin()` in every admin page | layouts don't re-run on client navigation | layout-only check |
| 24 | SW v3 never caches private HTML; static offline page | stale panel HTML after deploys → broken chunks | network-first page caching |
| 25 | Leaderboard hides other students' names by default (admin toggle; admin always sees) | privacy | names visible |
| 26 | In-app messenger browsers get a hint banner only | a page can't force the system browser | blocking playback |
| 27 | Verify with a local E2E harness with mocks; never touch production | production/server are off-limits to the AI | testing on the live site |
| 28 | One free session per topic; default topic price 390,000 toman (seed) | sales funnel | — |

## 3. Unverified assumptions (say so when relevant)

**Arvan**
- Secure-link parameters (`secure_expire_time` unix seconds, optional `secure_ip`) were written without docs initially;
  the owner later found the OpenAPI spec (default 24 h if omitted). Real expiry behaviour and whether the channel toggle is
  required have not been confirmed against production. `signedExpirySec()` only logs a mismatch.
- Whether the Arvan CDN in front of `dopingshimi.ir` proxies (changing `X-Real-IP`), caches anything, sends `ar-real-ip`,
  or injects HTML challenge pages. Mitigations exist (no-store; player/SW treat `text/html` as failure).
- The ~0.5 MB/s per upload connection cap is an observation from the import; playback download limits are unknown.

**Devices**
- None of the round 1–4 fixes ran on a real phone; only Chromium emulation (~30 scenarios).
- iOS assumptions from WebKit/hls.js bug reports, not observed: MMS doesn't keep the screen awake; native HLS does; Wake
  Lock works in an iOS standalone PWA; `navigator.standalone === true` identifies the home-screen app.

**Production state**
- Deployment of `da72570` unknown; `/admin/playback` data unknown; server NTP sync unknown.
- Not confirmed in the repo: SMS configured, channel secure link enabled, backups running.
- melipayamak codes 545211–545226 assumed still approved; REST vs console provider never tested end to end in production.

**Platform**
- "Next 16 layouts don't re-run on client navigation" (basis of 83c18bf) from docs/reasoning; no exploit reproduction.
- Single pm2 process assumed by all in-memory state (link cache, inflight, fresh limiter, login/OTP limiters, telemetry
  quotas, cron guard).
- The counts "53 videos (+ one duplicate)" and "~38 GB" are owner facts, not visible in code.

## 4. Documentation drift (known stale text outside docs/)

`README.md` (owner-facing, Persian) is partly outdated — trust the code and these docs:
- Features table says login is by SMS code; since `fbb5800` it is phone + password (SMS only for reset/optional OTP).
- The SMS template table still contains `dopingshimi.ir` links; code texts have none since `ab4630a`.
- "Playback link is made separately for each user" — the code caches one link per video; the watermark is the per-user protection.
- "IP lock in settings" is presented without the CDN caveat (keep it off).
- SMS section says general messages "need no pattern" and that messages without a pattern code go as normal SMS; the
  code wraps them into the approved `general` pattern 545226 whenever «استفاده از الگوها» is on (`sendTemplate` in
  `src/lib/sms/index.ts`); plain `sendSimple` is used only when neither applies.
- Says Ubuntu 24.04; install.sh supports 22.04 / 24.04. Says install.sh sets up a firewall; it only opens Nginx Full if
  ufw is already active. "Backups 14 days" = the 14 newest files of each type.
- Missing: telemetry / `/admin/playback`, Telegram import, doctor.sh output, `db:fixes`, E2E.
- `prisma/seed.ts` header comment still shows `pnpm db:seed -- --demo` (doesn't work; see OPERATIONS.md §12).
