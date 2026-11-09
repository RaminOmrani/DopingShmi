# تست E2E پخش ویدیو (Playwright + شبیه‌ساز CDN آروان)

این پوشه همان محیط تستی است که مشکل «سیاه شدن / ایستادن بعد از ۲–۳ دقیقه / بیرون انداختن دانش‌آموز» با آن
بازتولید و رفع شد. نسخه‌ی production سایت (`pnpm build` + `pnpm start`) روی پورت 3310 اجرا می‌شود، اما به‌جای
آروان واقعی به دو شبیه‌ساز محلی وصل است: یک API ویدیوی آروان (پورت 3399) و یک CDN ویدیو (پورت 3600) که می‌شود
به آن دستور داد لینک را منقضی کند، 403 بدون CORS بدهد، دانلود را بی‌صدا گیر بیندازد، قطعه‌ی خراب بفرستد و …
سناریوها با Chromium (شبیه‌سازی گوشی، کندی شبکه و CPU) پخش را تماشا می‌کنند و قبول/رد می‌دهند.
**هیچ‌چیز به سرور واقعی (dopingshimi.ir) یا آروان وصل نمی‌شود؛ فقط پایگاه داده‌ی محلی.**

The rest of this file is in English (technical reference for developers and AI agents).

---

## 1. What this is

* **App under test**: the real production build of this repo (`.next`, started by `ctl.sh app` with
  `ARVAN_API_BASE=http://127.0.0.1:3399/vod/2.0`), talking to the **local** PostgreSQL from the repo `.env`.
* **Mock Arvan VOD API** (`servers.js arvan`, :3399): `GET /vod/2.0/videos/vid-test|vid-nsNN` returns
  `hls_playlist = http://127.0.0.1:3600/t/<mintMs>/n/<ns>/master.m3u8` (the token is simply the mint time).
* **Mock CDN** (`servers.js hls`, :3600): serves the generated 3-level HLS stream from `vod/`; a link is valid for
  `valid` ms after its mint time, then 403 (like an expired Arvan secure link). Faults are injected per scenario
  through `/control` (see §6).
* **Scenarios**: `set1.js` (core playback + regressions), `set2.js` (platform, telemetry, app shell, admin report),
  `scenarios/frozen.js`, `scenarios/outage.js`; `run.mjs` is a friendly runner with names and a summary.
* **Isolation**: scenario slot `n` (1..20) owns test student `e2eu…n` (phone `0915900000n`), video `e2evidns…n`
  (Arvan id `vid-nsNN`) and mock namespace `nsNN`, so scenarios with different slots can run in parallel without
  sharing fault state, telemetry rate limits or progress rows.

**Emulation only.** Everything here runs in desktop Chromium. It approximates phones (Pixel 7 / iPhone 14 device
descriptors, CPU ×4, 0.6–2 Mbps, 150 ms latency) but cannot reproduce iOS Safari's native HLS, ManagedMediaSource,
real Screen Wake Lock, auto-lock or a home-screen PWA being killed by iOS (see §10). The fixes were verified here
(~30 scenarios passing on the `da72570` code) — **never on real phones, and production logs were never seen**.
After a deploy, the real-world check is `/admin/playback` (§8).

## 2. Files

| file | role |
|---|---|
| `servers.js` | mock CDN (:3600) + mock Arvan API (:3399); `node servers.js hls\|arvan\|both` |
| `ctl.sh` | start/stop the mocks and the app; each in its own session, stopped by PGID |
| `setup.mjs` | creates/updates test rows in the **local** DB and mints login JWTs into `.run/` |
| `gen-vod.sh` | generates the test HLS stream into `vod/` with ffmpeg |
| `lib.js` | shared helpers: browser/context with throttling, snapshots, timeline analysis, DB/telemetry queries |
| `set1.js`, `set2.js` | the scenario suites (`node set1.js <scenario>`, `node set2.js <scenario>[,…]`) |
| `scenarios/frozen.js`, `scenarios/outage.js` | standalone scenarios (frozen picture; configurable CDN outage) |
| `run.mjs` | runner: aliases, groups, preflight checks, pass/fail summary (`pnpm e2e …` from the repo root) |
| `probe.html` | plain hls.js page served by the CDN mock (`http://127.0.0.1:3600/probe.html?level=0&seek=90`) to compare raw hls.js with `VideoPlayer` |
| `package.json` | only `playwright` (dev); not part of the app's pnpm install |

Generated, gitignored: `vod/` (~66 MB), `.run/` (pid files, `hls.log`, `arvan.log`, `app.log`, `jwt/*.jwt`,
`admin.jwt`), `results/` (result JSON, console logs, screenshots), `node_modules/`.

## 3. Prerequisites

* Node ≥ 20, pnpm 10, bash, `curl`, `setsid` (util-linux), `psql` client.
* PostgreSQL running locally with the dev database from the repo `.env`
  (`DATABASE_URL` must point to localhost — `lib.js`/`setup.mjs` refuse anything else; `AUTH_SECRET` is read from
  `.env`, falling back to the DB `Setting 'auth.secret'` like the app). `.env` is never committed.
* A full `ffmpeg` (libx264 + aac) for `gen-vod.sh` (`apt-get install -y ffmpeg`).
* Playwright + Chromium:
  * **Claude cloud containers**: already there — `require("playwright")` resolves globally and Chromium is at
    `/opt/pw-browsers/chromium`; `lib.js` uses that path automatically when it exists.
  * Elsewhere: `cd tests/e2e && npm install && npx playwright install chromium` (or set `E2E_CHROMIUM=/path/to/chrome`).

## 4. One-time setup

```bash
service postgresql start                 # or however Postgres runs on the machine
pnpm install                             # repo root
pnpm db:push && pnpm exec tsx prisma/seed.ts --demo && pnpm db:seed-articles   # only for an empty DB: admin 09158148172, demo student 09150001000, topics
                                         # (not `pnpm db:seed -- --demo`: pnpm passes --demo to the last command of the chain)
pnpm build                               # the app under test is the production build; rebuild after every src change
tests/e2e/gen-vod.sh                     # ~1–3 min; skip if vod/ exists (--force to regenerate)
node tests/e2e/setup.mjs                 # idempotent; re-run when the JWTs expire (7 days)
```

`setup.mjs` writes to the local DB only: `Setting 'arvan'` = `{"apiKey":"test-key", secureLink:true, bindIp:false,
expireMinutes:360}` (it refuses to overwrite a non-test key unless `--force`), 20 students `e2eu000…001..020`
(phones `09159000001..020`, grade/major copied from the demo student), video `e2evid0000000000000000001`
(`vid-test`, legacy mock namespace) and videos `e2evidns000…001..020` (`vid-ns01..20`), all free and in the
first topic of the demo student's grade. `node tests/e2e/setup.mjs --clean` removes all of it (users, videos, their
telemetry) and blanks the test key.

Rebuild rule: `ctl.sh app` serves whatever is in `.next`. If `git rev-parse --short HEAD` differs from the build id
(`node -e 'console.log(require("./tests/e2e/lib").expectedBuild())'`) or `src/` changed after `.next/BUILD_ID`,
run `pnpm build` and `tests/e2e/ctl.sh app` again.

## 5. Start, run, stop

```bash
tests/e2e/ctl.sh up            # hls mock :3600, arvan mock :3399, app :3310 (refuses ports used by others)
tests/e2e/ctl.sh status
node tests/e2e/run.mjs list    # every scenario: slot, duration, what it checks
node tests/e2e/run.mjs quick   # hung-fragment + always403 (~4 min each)
node tests/e2e/run.mjs hung-fragment cors403 b-long
node tests/e2e/run.mjs hung-fragment always403 --parallel   # different slots only (run.mjs checks)
pnpm e2e quick                 # same runner from the repo root
node tests/e2e/set1.js s5      # a suite scenario directly (exit 0 pass / 1 fail / 2 harness error;
                               # run.mjs instead exits with the number of non-passing scenarios, 2 on preflight)
node tests/e2e/set2.js crash,inapp
API=hang TRIG=hang node tests/e2e/set1.js s7
SEEK=110 UNTIL_BUSY=1 node tests/e2e/scenarios/outage.js
tests/e2e/ctl.sh all-stop      # stops app + mocks by process group
```

`run.mjs --up` starts everything first, `--down` stops it at the end. Groups: `quick`, `video` (set1 without the
8-minute soak), `platform` (set2), `all` (~1.5 h sequentially).

Process rules: every process is started with `setsid` and its PGID is stored in `.run/<name>.pid`; `ctl.sh` stops
`kill -TERM -- -PGID` then `-KILL`. Never use `pkill -f <pattern>` here — a pattern that appears in your own shell
command line kills your shell. The app's stdout/stderr go to `.run/app.log` (server lines such as
`[video-error]`, `[play] fresh`, `[arvan] clock skew` appear there, like in pm2 logs on the server).

Ports: 3310 app, 3399 Arvan mock, 3600 CDN mock (override with `E2E_APP_PORT`, `E2E_ARVAN_PORT`, `E2E_HLS_PORT` for
every command). Ports 3000/3200/4310 are deliberately not used (dev server, production app, other apps on the server).

Parallelism: scenarios with different slots can run together (the original verification ran several at once on a
4 vCPU container), but timing-sensitive verdicts get flaky on a loaded machine; when something fails in parallel,
re-run it alone.

## 6. Mock CDN reference (`servers.js`)

Link format: `http://127.0.0.1:3600/t/<mintMs>/[n/<ns>/]<path>` — `<path>` is `master.m3u8`, `v0|v1|v2/index.m3u8`
or `v?/segNNN.ts`. The test stream: 150 s, 38 segments per level (37 × 4 s + 2 s), v0 640×360 ~0.66 Mbps,
v1 854×480 ~1.1 Mbps, v2 1280×720 ~2.1 Mbps (BANDWIDTH 655600 / 1095600 / 2085600), H.264 Main + AAC.

`GET /control?ns=<ns>&…` changes the state of one namespace and returns `{state, stats}`; `GET /stats?ns=<ns>` reads
it. From scenarios use `S.control(n, {...})` (adds `ns` for slot n). Parameters:

| param | effect |
|---|---|
| `reset=1` | back to defaults (valid 30000, everything else off) and zero the stats |
| `valid=<ms>` | link lifetime after its mint time; older links get 403 (`86400000` = effectively never) |
| `epoch=<ms>` | links minted before `epoch` count as minted at `epoch` (a "fresh" server-side link cache without restarting the app) |
| `always403=1` | every request 403 (with CORS headers) — the link is permanently rejected |
| `cors403=1` | expired links get 403 **without** CORS headers (the browser sees status 0 like a network error) |
| `fail500=1` | every `.ts` request → HTTP 500 (CDN outage) |
| `dropRate=<0..1>` | that share of `.ts` responses send headers + 1/3 of the body and then reset the connection |
| `loop=<k>` | level playlists repeat the 38 segments k times with `#EXT-X-DISCONTINUITY` (k × 152 s video) |
| `corruptSeg=segNNN.ts` `corruptCount=<k>` | the next k responses for that segment name (any level) are corrupted |
| `corruptMode=payload\|allpayload\|garbage\|444` | scramble video payload / all ES payload / whole file random / serve `vod/badsegs/v?-seg025-444.ts` (valid H.264 High 4:4:4 the browser can't decode; seg025 only) |
| `hangNext=<k>` (+`hangLevel=v1`) | the next k `.ts` requests (optionally only that level) hang |
| `hang=v0:1,v1:2` | per-level hang counters |
| `hangMode=body\|head` | `body`: 200 + headers + 1/3 of the body, then silence with the socket open (the reproduced 2-minute freeze); `head`: no response at all |
| `releaseHangs=1` | destroy all hung sockets |

Every request is logged to `.run/hls.log` as JSON (`ms`, `ns`, `path`, `status` = 200 \| 403 \| 404 \| 500 \| `DROP`
\| `HANG` \| `CORRUPT`, `age` of the link, `cors`, `level`); Arvan calls go to `.run/arvan.log` (only `authOk`, never
the header). `S.hlsLog()` reads the CDN log; scenarios filter it by `ns` and time.

## 7. Scenarios and pass criteria

Each scenario stores `verdict` (named booleans) and `pass` (= all true). Common verdicts in set1:
`urlUnchanged` (never navigated away from the watch page), `noPageError` (no uncaught JS error),
`noFalseExitRows` (no `abnormal-exit` / `hidden-playing` rows caused by the harness reloading or leaving).

| name (`run.mjs`) | suite:id, slot | setup | passes when |
|---|---|---|---|
| hung-fragment | set1:s1, 1 | 456 s video, 0.9 Mbps, CPU×4; after 60 s one v0 segment hangs mid-body | hang hit; freeze ≤ 20 s; no overlay; `frag-stall` row; continues ≥ 60 s past the hang |
| hung-manual480 | set1:s2, 2 | 1.5 Mbps, user picks 480p, then a v1 hang (`HANGN=2` for two) | 480 applied; recovery ≤ 20 s; ≤ 1 `quality-demoted`; if demoted, still auto after reload |
| hung-head | set1:s3, 3 | v0 hang before headers | hls.js aborts after the 12 s TTFB timeout; no `frag-stall` before that; recovery ≤ 25 s |
| slow-link | set1:s4, 4 | 0.85 × lowest bitrate for 4.5 min | no `frag-stall`, no `?fresh=1`, no refresh/give-up kinds, no overlay, t > 150 |
| cors403 | set1:s5, 5 | links valid 60 s, expired → 403 without CORS | 403 seen without CORS; `?fresh=1` within ~65 s; new token used; `link-suspect` row; no overlay; t > 150 |
| always403 | set1:s6, 6 | after 36 s every request 403, seek to 120 | overlay ≤ 100 s; `giveup` row; support code on overlay = start of a telemetry sessionId; auto-retry 25–40 s after the overlay; progress row not zeroed after leaving |
| api-outage | set1:s7, 7 | `/play` 503 (`API=hang`: 20 s hang) while a corrupt segment (`TRIG=hang`: hangs) forces recovery | problem injected; API called; `refresh-bad` row; no give-up/overlay; same link kept; keeps playing |
| html-fresh | set1:s8, 8 | `/play?fresh=1` returns a CDN HTML challenge during recovery | `refresh-bad` mentioning text/html; link deadline not zeroed (> 300 s left); no give-up; keeps playing |
| html-fresh-expired | set1:s8c, 18 | link expires after 50 s and fresh links return HTML | no give-up within 30 s of the first `refresh-bad`; retried ≥ 2 times; deadline not zeroed |
| html-initial | set1:s8b, 15 | first `/play` returns HTML | Persian box «اتصال برقرار نشد» + «تلاش دوباره»; `load-fail` row; support code |
| offline-blips | set1:s9, 9 | 7 offline periods of 5–15 s over 5 min (`SHORT=1`: 3 min) | no overlay; continues; progress row matches the player (±6 s); a js-error made offline arrives later as `queued` |
| manual720 | set1:s10, 10 | 1.5 Mbps, user picks 720p | demoted to auto within ≤ 3 stalls; toast «کیفیت روی «خودکار» رفت»; auto after reload |
| b-long | set1:s11a, 11 | links valid only 30 s, 130 s desktop play | no overlay; no stall > 5 s and no jump back; t ≥ 120; progress row matches |
| n-outage | set1:s11b, 16 | seek to 110 + 20 s CDN 500 outage | «در حال اتصال دوباره» badge 2–8 s after; resumes at t < 113; no overlay |
| d3 | set1:s11c, 17 | permanent 403 + hide tab + leave page while overlay shown | overlay; progress row never drops below the pre-failure position |
| soak | set1:s12, 12 | 8 min (loop 5) with 4 offline blips and 2 hangs | ≤ 2 `frag-stall`; heap flat; back buffer ≤ 36 s; forward ≤ 65 s; t > 380 |
| ios-engine | set2:ios, 13 | iPhone 14 UA, faked `navigator.standalone` / HLS `canPlayType` / no MSE | standalone → `engine` row `native` (ios-app), no hls.js chunk, no quality menu, native src; Safari tab or `ds-engine=hls` → hls.js |
| wake-lock | set2:wake, 14 (+13) | fake `navigator.wakeLock` recording requests/releases | none before play; request on play; released by "browser" when hidden, re-requested on visible; held through a forced refresh; released on pause / ended / give-up / unmount; `hidden-playing` row with idleSec/standalone/wakeLock |
| wake-refresh | set2:wake2, 11 | real expired-link refresh (403 with CORS) | refresh happened; lock held the whole time; no release/new request |
| native | set2:native, 19 | `ds-engine=native` (Chromium native HLS) + 8 s offline | native engine row; no silent paused frame > 3 s; playing or «ادامه‌ی پخش» at the end |
| crash | set2:crash, 20 | `Page.crash` while playing, reopen in a new tab | one `abnormal-exit` with the old sessionId, position ±7 s, prevVis visible, prevPlaying; no banner on the watch page |
| pwa-relaunch | set2:pwa, 1 | unclean `ds-watch` marker, open `/panel?source=pwa` | banner «پخش ویدیو نیمه‌کاره ماند» linking to the video; `abnormal-exit` relaunch=true once; no banner after reload / on the watch page |
| clean-nav | set2:cleannav, 2 (+3) | SPA link and full navigation away while playing | marker clean; no `abnormal-exit`; no banner; ≥ 2 `session-end` |
| exits | set2:exits, 15 | reload, navigation, tab close, ended, SPA away | no `abnormal-exit`/`hidden-playing`; no banner; markers clean; ≥ 5 `session-end` |
| session-end | set2:summary, 3 | 2 min play, close tab | one session; playedSec 120 ± 8; 0 stalls; engine `hls`; build = the running build |
| api | set2:api, 4+5 | direct HTTP calls | `/play` `private, no-store` + `Vary: Cookie`; playback-log 200/400/401/413, eid dedupe; progress past 50 min with no failed INSERT (rollback counter + newest Postgres log) |
| shell | set2:shell, 6 | Pixel 7 | overscroll none on watch only; BottomNav hidden in landscape on watch only; grain only on public pages; Persian error page; static offline page; SW `ds-v3`; no `/panel` HTML cached; offline navigation shows the offline page |
| chunk-offline | set2:chunkoff, 6 | chunk requests aborted while "offline" | Persian offline message, no reload while offline, one reload when online; `js-error` chunk=true |
| inapp | set2:inapp, 7 | Telegram / WebView / normal UA | hint «برای پخش بهتر، سایت را در Chrome یا Safari باز کنید» only in-app |
| admin | set2:admin, 3+8 | admin JWT | `/admin/playback` sections, build shown, kind/sid/range/user filters, sampling notice (> 5000 rows), no overflow at 390 px, student redirected — run it **after** other scenarios (needs fresh telemetry) |
| frozen-a / frozen-b | scenarios/frozen.js A\|B, 20 | `playbackRate=0` once / forever | A: recovers, no overlay, freeze ≤ 15 s, `stall-buffered` row. B: overlay ≤ 160 s (known residual ≈ 130 s), `giveup` row, retry plays |
| outage | scenarios/outage.js, 16 | `OUTAGE_MS` (20 s), `UNTIL_BUSY=1`, `EXTRA_MS`, `SEEK`, `AFTER_MS` | 500s injected; no overlay; badge if it stalled; resumes ≤ 10 s after recovery (same second after a seek); no jump back |

Env knobs: `HANGN` (s2), `API=503|hang`, `TRIG=corrupt|hang`, `CCOUNT` (s7), `TRIG` (s8), `SHORT=1` (s9),
`NOEXITCHK=1` (skip `noFalseExitRows`), `E2E_BUILD` / `E2E_HLS_CHUNK` (override build detection), `E2E_PG_LOG`.

## 8. Reading results and telemetry

`results/<set1|set2|scenarios>/result-<name>.json`:

* `verdict`, `pass`, `error` (harness exception), `pageErrors`, `consoleErrors`, `navs`.
* Timelines (`tl`, `tl0`, …) — one line per second:
  `95.1s t=91.3 p=0 rs=4 h=360 sel=0 buf=[60.1-152.0] fwd=60.7 back=31.2 BUSY OVERLAY TAP heap=14.2` =
  wall time since the context opened, `currentTime`, paused, `readyState`, `videoHeight`, quality select
  (`0` = auto), buffered ranges, forward/back buffer, «در حال اتصال دوباره» badge, «تلاش دوباره» overlay,
  «ادامه‌ی پخش» tap prompt. `<tl>Analysis` = `maxStallMs`, `stalls`, `jumpsBack`, `overlaySamples`, … (a
  sample taken during a source swap, rs=0 t=0, counts as a frozen picture, not a jump to 0).
* `segs` — every CDN request: `start-end s status [tk<mint time>]/v1/seg012.ts` (or `FAIL(net::…)`); `api` — app
  API calls; `events` — media events inside the page; `hlsStats` — mock counters.
* `telemetry`, `telemetryCounts`, `telemetryCtx`, `sessionEndSum`, `progress` (the `VideoProgress` row).
* `console-<name>.log` next to it — the page console.

Telemetry is the `PlaybackEvent` table (`prisma/schema.prisma`): `createdAt` (UTC, no time zone), `userId`,
`videoId`, `sessionId` (one per player mount), `kind`, `engine` (`hls` | `native` | `file`), `build` (commit
id baked into the build), `position`, `code`, `fatal`, `detail`, `ctx` (JSON: device/network/player state;
for `session-end`: `playedSec`, `wallSec`, `stalls`, `stallMsTotal`, `maxStallMs`, `refreshes`, `giveups`,
`fragStalls`, `qualityChanges`, `startupMs`, …), `queued` (sent later after being offline). Kind meanings: the
legend in `src/app/admin/playback/kinds.ts` (shown on `/admin/playback` as «راهنمای رخدادها»). The support code on
the player's error overlay («کد پیگیری») is the first 6 characters of `sessionId`; `/admin/playback?sid=<code>` filters
by it. Useful SQL (local DB):

```sql
select "createdAt", kind, engine, build, position, code, detail from "PlaybackEvent"
 where "userId" = 'e2eu000000000000000000006' order by "createdAt" desc limit 50;
select kind, count(*) from "PlaybackEvent" where "createdAt" > now() - interval '1 hour' group by 1 order by 2 desc;
```

On production the same rows are read on `/admin/playback` («گزارش پخش ویدیو») and in `pm2 logs doping`
(`[video-error]`, `[play] fresh`, `[arvan] clock skew`); `deploy/doctor.sh` prints the deployed commit.

## 9. History and known flakiness

* The harness was first built in a scratch folder while fixing the video problems (commits `62136f9` … `da72570`);
  its last full re-verification on the `da72570` code passed ~30 scenarios. The failures of that run were harness
  artifacts, fixed while porting it here:
  * `b-long` "continuous": a 1 s sample landed inside a source swap (t=0, rs=0) and counted as a jump back to 0 →
    `analyze()` now treats such samples as a frozen picture.
  * `wake-lock` "refreshHappened": the harness restored link validity right after the first 403 and waited only 30 s,
    but the player retries status-0 failures until the ~60 s forward buffer runs dry → the 403 now stays until the
    player asks for a fresh link (up to 110 s).
  * `api` "noFailedInsert" (an old VIDEO_DONE point row collided) and `exits` "sessionEndRows" failed once each and
    passed on re-run.
* After the port (this folder, build `da72570`, Claude cloud container, 4 vCPU): `hung-fragment`, `always403`,
  `b-long`, `wake-lock`, `pwa-relaunch`, `frozen-a`, `outage` passed (run with `--parallel` in groups of 2–5).
  The other scenarios were ported unchanged apart from paths/build detection and have not been re-run since.
* Known product residuals (not test bugs): three back-to-back hung segments still freeze ~45–60 s; a permanently
  frozen picture reaches the give-up overlay only after ~130 s (`frozen-b`); in-app messenger browsers only get a hint.

## 10. Caveats

* Chromium cannot emulate iOS: `ios-engine` only checks the engine *choice* with faked `navigator.standalone`,
  `canPlayType` and missing MSE; `native` uses Chromium's own HLS support. Wake Lock is a JavaScript fake
  (`set2.js` `WAKE_INIT`); auto-lock, iOS killing the PWA, real ManagedMediaSource behaviour, CDN edge behaviour,
  Iranian international-link quality and real Arvan secure links are not covered.
* Throttling is CDP network/CPU emulation, not a real radio; timings are wall-clock based and get flaky under load.
* The harness writes to the local DB (test users/videos, `Setting 'arvan'`, telemetry rows, `admin` inserts and
  deletes a few temporary rows). **Never run it on the production server**: the production DB is also on 127.0.0.1,
  so the local-DB check alone would pass, `setup.mjs` would write test rows and `ctl.sh app` would start a second Next
  process (duplicate hourly cron/SMS). `lib.js` and `ctl.sh` therefore refuse to run when they see `/opt/doping`,
  `/var/lib/doping` or `/etc/nginx/sites-enabled/doping`. Do not commit `.run/`, `vod/`, `results/`.
* `pnpm build` in place replaces `.next`; restart the app (`ctl.sh app`) afterwards.
* The root `tsconfig.json` excludes `tests/e2e`: its `**/*.ts` include would otherwise pick up the MPEG-TS video
  segments in `vod/` (they end in `.ts`) and break `pnpm typecheck` and `pnpm build`. Keep that exclude.

## 11. Adding a scenario

Copy an entry of `SC` in `set1.js` (or a file in `scenarios/`): `setup(n, mockState, loop)` → `run(n, name, openOpts,
async (o, res) => { … res.verdict = {…} })`. Inside: `S.gotoWatchReady(o)`, `S.tapPlay(o)`, `S.monitor(o, ms)`,
`S.control(n, {...})`, `S.telemetry(n, since)`, `S.progress(n)`, `S.common(o, tl).urlUnchanged`. Use a free slot
(see `node run.mjs list`), add the alias to `run.mjs` and a row to §7.

## 12. Troubleshooting

* `port … is already in use by another process` — something else listens there; stop it or move the E2E ports.
* `missing tests/e2e/.run/jwt/…` or the page lands on the login screen — run `node tests/e2e/setup.mjs` (JWTs last
  7 days; a changed `AUTH_SECRET` also needs a re-run).
* `app not built` / old behaviour — `pnpm build`, then `tests/e2e/ctl.sh app`.
* `psql failed` — Postgres not running (`service postgresql start`) or `.env` `DATABASE_URL` wrong.
* `playwright not found` / browser missing — see §3.
* A result has `error` — harness exception (selector timeout, crash); read the stack in the JSON and the console log.
