# Video system — end to end

How lesson videos are stored, signed, played, recovered and monitored. Checked against `da72570` (2026-11-08).
This is the most-worked-on and most fragile area of the project (the "black screen / stops after 2–3 minutes /
kicks students out" saga, see [HISTORY.md](HISTORY.md)). Read §7 before touching the player.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [OPERATIONS.md](OPERATIONS.md) (logs, deploy) · [TESTING.md](TESTING.md) +
[`tests/e2e/README.md`](../tests/e2e/README.md) (the harness that reproduces the failures) · [TODO.md](TODO.md).

Contents: 1 Big picture · 2 Server side · 3 Player · 4 Threshold cheat sheet · 5 Telemetry · 6 Admin playback report ·
7 Troubleshooting playbook · 8 Admin pages for video · 9 Telegram → Arvan import · 10 Arvan settings and secure link ·
11 Known residual issues and ideas

---

## 1. Big picture

```
student phone ──(international path)──► dopingshimi.ir (ArvanCloud CDN) ──► nginx on the Swedish VPS ──► Next (pm2 "doping")
     │                                    /api/videos/[id]/play   (signed link, every open + every refresh)
     │                                    /api/videos/[id]/progress, /api/playback-log
     │
     └──(domestic path)──► Arvan VOD CDN: master.m3u8 + segments (the actual video bytes)
```

- Videos live in ArvanCloud VOD (Growth plan, channel «doping shimi»), never on the VPS. A `Video` row stores
  `arvanVideoId` = the Arvan video id, **or** a direct `http(s)://…m3u8|mp4` URL (test/other sources; no signing, no expiry).
- The site asks the Arvan API for a **secure link** (expiring) and hands it to the player. One link is cached per
  **video** (plus per IP only if `bindIp`), so students watching the same video share a link; the per-user deterrent is
  the moving phone-number **watermark**. (README's "link per user" claim is outdated.)
- Design principle since `da72570`: the `/api` path (international, slow from Iran) may fail while the Arvan link is still
  valid → the player keeps playing / rebuilds on the still-valid link instead of giving up.
- All in-memory state below (link cache, inflight map, fresh throttle, telemetry quotas) is **per process** and resets on
  every `pm2 reload` (deploy). pm2 runs a single fork process; cluster mode would make these per-worker.

## 2. Server side

### 2.1 Arvan client — `src/lib/arvan-api.ts` (no Next deps; also used by `scripts/tg.ts`)
- `ARVAN_API` = `process.env.ARVAN_API_BASE || "https://napi.arvancloud.ir/vod/2.0"` (read at module load; the E2E harness
  points it at a mock). `authHeader(key)` adds the `Apikey ` prefix.
- `arvanTitle(t)`: trims to 200 chars; titles shorter than 5 chars become `ویدیو <t>` (Arvan rejects them; commit cbecd5d).
- `arvanApi(apiKey)`: `json()` (20 s timeout; surfaces Arvan field errors joined with ` | `), `channels()`, TUS
  `createUpload()` / `offset()` (404/410 → null = upload gone) / `upload()` (PATCH 8 MB chunks, 15 min per chunk, up to 8
  consecutive failures with backoff ≤ 60 s, re-reads the real offset), `createVideo()` (`convert_mode` auto or profile,
  `thumbnail_time: 10`), `updateVideo()` (title), `videos(channelId)` (paginated, ≤ 40 × 100), `fileIdFromUploadUrl()`.

### 2.2 Signed links — `src/lib/arvan.ts` (server-only)
- `getPlayback(videoId, ip?, {fresh})`:
  - `ttl = max(60, expireMinutes) × 60` s. Cache key `` `${videoId}|${bindIp ? ip : ""}` ``.
  - A cached link is reused only while at least `minLeft = min(0.9·ttl, max(ttl/2, 2 h))` remains. With the default
    360 min → every viewer gets a link with ≥ 3 h left. With 60 min → minLeft 54 min (cache ~useless).
  - Cache entry ignored if the `secureLink` flag changed since minting.
  - `fresh` dedupe: if the cached link was minted < 10 s ago and has > 60 s left, return it (many students refreshing
    during an outage → at most one mint per video per 10 s).
  - `inflight` map: concurrent requests for the same key share one Arvan call.
- `mint()`: with secure link, `exp = now + ttl`; query `secure_expire_time=<unix seconds>` and `secure_ip=<ip>` only if
  `bindIp && ip`. Without secure link: cached 6 h (or ttl), `expiresAt` undefined (player has no deadline). Maps
  `hls_playlist`, `dash_playlist`, `player_url`, `thumbnail_url`, duration, status, title. **Only links with `hls` are
  cached** (not-yet-converted videos aren't). Cache wiped if > 2000 entries.
- `clearPlaybackCache()` runs when Arvan settings are saved.
- Diagnostics only (no behaviour change), each at most once per 10 min:
  - `[arvan] clock skew <N>s (arvan minus server; check: timedatectl)` when |Arvan `Date` − server clock| > 60 s.
  - `[arvan] signed expiry differs by <N>s (…)` when exactly one 10-digit unix timestamp found in the HLS URL differs
    > 300 s from the requested expiry.
- `arvanChannels()` (`/channels`, typed with `secure_link_enabled`), `arvanClient()` (throws
  «کلید API آروان در تنظیمات ثبت نشده است» without a key).

### 2.3 `GET /api/videos/[id]/play` (`src/app/api/videos/[id]/play/route.ts`)
1. `mustUser` (401) → video exists and `published` (404 «ویدیو یافت نشد») → `canWatch` (403
   «برای دیدن این ویدیو باید مبحث را تهیه کنید») → `arvanVideoId` set (409 «این ویدیو هنوز بارگذاری نشده است»).
2. Base: `lastPosition` (VideoProgress), `watermark` = user phone if `arvan.watermark`, `duration` = `Video.durationSec`.
3. Direct URL ids: `.m3u8` → `hls`, else `mp4`; no expiry.
4. `?fresh=1` is honoured at most once per **15 s per user+video** (`lastFresh`; timestamp set only after Arvan succeeded;
   map cleared at > 5000). A throttled request still gets a (cached) link. Every `fresh=1` request logs
   `[play] fresh {"user","video","throttled"?,"ms"}`.
5. Response `{lastPosition, watermark, duration, hls, playerUrl (only if no hls), poster, expiresAt, serverNow}`. 409
   «ویدیو هنوز در آروان آماده‌ی پخش نیست» if neither hls nor playerUrl. Arvan failure → `console.error("arvan" | "arvan (fresh, Nms)", e)`
   and **502** «اتصال به سرور ویدیو برقرار نشد؛ کمی بعد دوباره تلاش کنید».
6. All responses `Cache-Control: private, no-store, max-age=0` + `Vary: Cookie`.

### 2.4 `POST /api/videos/[id]/progress`
Body `{position, delta, duration?}`; 403 without access. Learns `durationSec` from the player when the DB has 0 and the
player reports > 10 s. `delta` capped at **40**; `watchedSeconds` capped at `max(3 × duration, 600)`; `completed` =
already completed OR (`watched ≥ 0.8 × duration` AND `position ≥ 0.75 × duration`). Adds `Activity.videoSec` (Tehran day).
Points: `VIDEO_TIME` per full 300 s of `min(watched, duration)` (refId `${videoId}:${n}`, pre-checked in one query),
`VIDEO_DONE` once → response `{completed, justCompleted, bonus}` (player shows «دیده شد» chip + toast).
Changing the points: the amount per block is the setting `points.videoPer5Min` (Admin → «تنظیمات» → «امتیازدهی» →
«هر ۵ دقیقه تماشا», default 1, 0 disables, not retroactive). The **300 s block length is hardcoded** here (`/ 300`), and
the idempotency refIds `${videoId}:${n}` count those blocks: changing the length renumbers blocks against existing
`PointLog` rows (double or missed awards), so it needs a code change plus a refId migration plan. While `durationSec` is 0,
watched time is capped at 600 s (at most 2 blocks) until the player reports the duration.

### 2.5 Telemetry endpoints
`POST /api/playback-log` and legacy `POST /api/videos/[id]/error` → §5.

## 3. Player — `src/components/panel/VideoPlayer.tsx` (~1565 lines, client) + `src/components/panel/player/*`

Mounted only on `/panel/videos/[id]` (when `canWatch`), below `<InAppHint/>`. `WatchMarker` lives in the panel layout.

| module | role |
|---|---|
| `player/fetch-play.ts` | `/play` fetch with AbortController timeout (iOS 15 lacks `AbortSignal.timeout`); reads the body only if `application/json` |
| `player/hls-watchdog.ts` | 1 s watchdog for the hls.js engine (§3.5) |
| `player/wake-lock.ts` | Screen Wake Lock holder (§3.7) |
| `player/telemetry.ts` | `createReporter(videoId)`: session id, per-session caps, ctx trimming (§5) |
| `player/media.ts` | buffer helpers (`aheadOf`, `nearEnd`, `nextRangeStart`, …) |

### 3.1 Lifecycle
- Mount: new reporter (new `sessionId`; **support code** «کد پیگیری» = first 6 chars), flush queued telemetry, window
  `error`/`unhandledrejection` → `js-error`.
- Initial `fetchPlay('/api/videos/<id>/play', 20000)`. Our JSON error → message (retry button unless 403/404; login
  button on 401). HTML response (CDN challenge / nginx error page, e.g. during an in-place deploy build) → retry does
  `location.reload()`. Timeout/network → retry. Each failure reports `load-fail {code, detail: content-type|timeout|network}`.
- Resume position: server `lastPosition` if > 5 s and < duration − 10.
- `playerUrl` only (Arvan has no HLS yet) → plain `<iframe>`: **no telemetry, progress or watermark** on that path.
- Render: `<video controls playsInline controlsList="nodownload noremoteplayback">`, context menu disabled, moving phone
  watermark (moves every 7 s), badge «در حال اتصال دوباره…» while busy/stalled, tap overlay «ادامه‌ی پخش» when autoplay is
  blocked, give-up overlay with «تلاش دوباره» (or «ورود دوباره» on login loss) + «کد پیگیری: …», quality `<select>` only for
  hls with > 1 level (native shows «کیفیت به‌طور خودکار با سرعت اینترنت تنظیم می‌شود.»).

### 3.2 Engine selection
1. localStorage `ds-engine = native`, or **iOS home-screen PWA** (`navigator.standalone === true`) unless `ds-engine = hls`
   → **native** HLS (`why = override | ios-app`).
2. Else dynamic `import('hls.js')`: `Hls.isSupported()` → **hls** (`mse` / `override`); else native if
   `canPlayType('application/vnd.apple.mpegurl')` (`no-mse`); else mp4 → `file`; else «مرورگر شما از پخش این ویدیو پشتیبانی نمی‌کند».
   Import failure → native/file (`import-failed`). hls.js media error before levels or `MANIFEST_INCOMPATIBLE_CODECS_ERROR`
   → switch to native (`fallback:<details>`).
- Why iOS app → native (da72570): in an iPhone home-screen PWA, hls.js uses ManagedMediaSource, which does not keep the
  screen awake (WebKit FB17984089 / hls.js #6725) → auto-lock → black screen; relaunch = "thrown out". Native AVPlayer +
  Wake Lock should keep it on (**assumption, not verified on a real iPhone**). Safari tabs use hls.js on iOS ≥ 17.1
  (ManagedMediaSource); iPhone Safari before 17.1 has no MSE and already gets native (`no-mse`).
- Override (developer/support tool): on **that device's** browser console `localStorage.setItem('ds-engine','native')` or
  `'hls'`, reload; remove the key to reset. Reported in the `engine` event (`ctx.engineWhy`). Limits:
  - `native` is honoured only when `canNative` is true (an HLS URL exists and `canPlayType('application/vnd.apple.mpegurl')`);
    otherwise the player silently stays on hls.js and reports `hls mse`.
  - An iPhone home-screen app has its own storage, separate from Safari, and no console: it needs a Mac with Safari Web
    Inspector and a cable. Setting the key in Safari does nothing for the app.
  - There is no URL or admin switch, so support cannot realistically force an engine on a student's phone. A remote
    override needs a code change (idea: `?engine=native|hls` on the watch page that writes the key; [TODO.md](TODO.md)).

### 3.3 hls.js config (`createHls`)
- `maxBufferLength: 30`, `maxMaxBufferLength: 60`, `backBufferLength: 30` (were 60/120/90 before da72570 — a ~120 s
  forward buffer is why a hung download surfaced ~2 min in), `errorPenaltyExpireMs: 30000`, `startLevel: -1`.
- Load policies `policy(ttfb, total, timeoutRetry, errorRetry)`: manifest `15 s / 30 s, rc(3,500,4000), rc(3,1000,8000)`;
  playlist `15 s / 30 s, rc(4,…), rc(4,…)`; **fragment `12 s / 120 s, rc(6,1000,8000), rc(8,1000,8000)`**.
  `maxLoadTimeMs` is a total cap, not idle detection — lowering it kills slow-but-healthy downloads; idle detection is the
  watchdog's job.
- `shouldRetry`: never retry 401/403/410 (needs a new link); status 0 non-timeout retried up to maxNumRetry.
- After a rebuild: `abrEwmaDefaultEstimate = lastBw`, `testBandwidth: false` (no probe fragment on slow networks).
- Auto-quality cap computed once at load: `min(screen w,h) × min(DPR, 2) × 1.1` (replaces `capLevelToPlayerSize`, which
  flushed the buffer on fullscreen).

### 3.4 Error handling and link refresh
- **401/403/410** on any load: report `expired-link` once per instance (detail + ` failover` if not renewing). Renew
  (`refresh("expired")`) only if fatal, or a playlist load, or the link has < 10 min left; otherwise hls.js fails over.
- **Fatal network**: manifest errors → `refresh("manifest")`. Fragment/level errors that look like a rejected link — status
  0 while online and not a timeout (a CORS-less 403/429 from the CDN looks like status 0), or 4xx except 416 — and not yet
  tried for this URL → `link-suspect` + `refresh("http<code>" | "net0")`. Otherwise retry `startLoad(pos)` after
  `min(1000·2^n, 15000)` ms (waits for `online` when offline); `> 6` tries → `giveUp("net-tries")`.
- **Fatal media**: incompatible → native fallback or `giveUp("media-incompatible")`; else `recoverMedia` (> 3 media errors
  in 60 s → `refresh("media")`; `swapAudioCodec()` if the previous recover was < 3 s ago).
- **Native `<video>` error** → `native-error {code: MediaError.code}` → `refresh("native")`.
- `refresh(reason)`: ≥ 3 attempts in the last **120 s** → `refresh-loop` + `giveUp("refresh-loop:<reason>")`. Else wait
  `REFRESH_DELAYS[attempt]` = **0 / 16 / 32 s** (2nd+ attempts fall outside the server's 15 s fresh throttle), then fetch
  `/play?fresh=1` (15 s timeout). Budget resets after 20 s of good playback past the refresh point.
- `doRefresh` outcomes:
  - reason `recover-stuck` but playback already recovered → keep the new link as `spare`, report `refresh-skip`;
  - link reason (`expired|expiring|net0|http4xx`) but the server returned the **same URL** (throttled) → `refresh-bad same-url`, retry;
  - new link → `install(link)`;
  - failure → `refresh-bad {code, detail:"<reason> <content-type>"}`. Our own JSON 401/403/404 → **final** give-up
    (401 shows «ورود دوباره»; no auto-retry). Else a `spare` link → install it. Else if the reason is not a link reason and
    the current link has > 5 min left → `install(null)` (rebuild on the same still-valid link) + background refresh in
    30 s. Else cause server/net and `refresh()` again.
- `install(link|null)`: keeps position, rebuilds hls.js (or swaps native `src` + `play()`), new deadline from `expiresAt`
  converted with `serverNow` (**clock-skew safe**: a phone with a wrong clock no longer loops).
- `onPlay` pre-refresh: link < 3 min left, no refresh in the last 60 s, not recovering → `refresh("expiring")`.
- `checkRecoveryStuck` (1 s): recovering ≥ 30 s without `canplay`, visible, online, and (hls) no bytes ≥ 20 s →
  `recover-stuck` + `refresh("recover-stuck")`.
- Native watchdog (non-hls, every 4 s): playing, online, visible, not near end, currentTime unchanged and buffer not grown
  > 0.5 s for > **40 s** → `native-stall` + `refresh("stall")`.

### 3.5 hls watchdog — `player/hls-watchdog.ts` (ticked every 1 s)
Inactive (resets) while the player is busy (refreshing / gave up / pending give-up / recovering / network retry pending
/ student doesn't want playback), paused, ended, hidden, or within 2 s of the end.

- **Hung download**: tracks bytes of the in-flight main fragment after its first byte (before that, hls.js's 12 s TTFB
  applies). No new bytes for ≥ `FRAG_IDLE_MS` 10 s AND (ahead < `LOW_AHEAD` 20 s OR playhead stuck ≥ 2 s) AND ≥
  `KICK_GAP_MS` 20 s since the last kick → `frag-stall {lvl, sn, loaded/total B, idle, ahead, kick=N}`;
  kick 1 = `startLoad(pos)` (abort + restart), kick 2 = demote manual quality to auto + `startLoad`, kick ≥ 3 =
  `refresh("frag-stall")`. Kicks reset on a buffered main fragment. At `readyState 0` only the hung-first-fragment check runs.
- **Escalation ladder** while the playhead hasn't moved ≥ 0.5 s:
  - (a) stuck ≥ 3 s and `!hls.bufferingEnabled` → `hls-resume-buffering` + `resumeBuffering()` (iOS MMS after lock/background);
  - (b) ahead ≥ 1.5 s (frozen picture with data): ≥ 6 s → nudge `currentTime += 0.1` (`stall-buffered nudge`); ≥ 15 s →
    `stall-buffered recover#N`: N=1 `recoverMedia`; N=2 → seek +2 s if ahead > 3, else `refresh`; N=3 → `refresh`;
    N≥4 → `giveUp("stall-buffered")`. Counter resets if stuck > 5 s away from the last spot or after 20 s good playback;
  - (c) ahead < 0.5 s, stuck ≥ 3 s, next buffered range ≤ 2 s ahead, max 2 per stall → `hls-skip-hole` (seek over);
  - (d) stuck ≥ 40 s AND no bytes ≥ 30 s AND online → `hls-stall`; first → `refresh("stall")`, second without 20 s good
    playback → `giveUp("stall")`.

### 3.6 Give-up, auto-retry, quality
- `giveUp(why)`: if playing with > 3 s buffered → **deferred** (keep playing the buffer); cancelled (`giveup-cancelled`) if
  the buffer end grows > 8 s past the deferral point; fires when ahead < 1 s or the playhead is frozen > 5 s. Then: pause,
  exit fullscreen, release wake lock, overlay with a cause message (`MSG_NET` / `MSG_LINK` / `MSG_MEDIA` / `MSG_SERVER` /
  `MSG_LOGIN`), progress frozen, report `giveup {detail:"<why> cause=<cause> deferred=Ns"}` (or `retry-fail` if it was an
  auto-retry).
- **Auto-retry** after give-up: at 30 / 60 / 120 s (`AUTO_RETRY_DELAYS`), plus on `online` and on page visible; only while
  visible; ≥ 10 s apart; resets budgets and calls `refresh("auto-retry")`; overlay stays until playback actually resumes
  (`retry-ok {detail: manual|auto-<why>}`). Manual «تلاش دوباره» resets everything and calls `refresh("manual")`.
- **Quality** (hls only): menu = distinct heights + «خودکار». Choice saved in localStorage `ds-quality` (height; 0 = auto).
  A remembered choice is applied only after 2 main fragments and only if bandwidth ≥ 1.2 × that level's bitrate.
  **Demotion to auto** (toast «به‌خاطر کندی اینترنت، کیفیت روی «خودکار» رفت», `quality-demoted`, pref reset to 0): ≥ 3
  eligible stalls or > 5 s stalled within 60 s on a non-lowest manual level; or waiting ≥ 15 s on a manual level; or
  watchdog kick #2.
- Badge: `waiting` > 4 s → «در حال اتصال دوباره…». Stall ≥ 15 s → `long-stall`.

### 3.7 Wake lock, progress, crash detection
- **Wake lock** (`wake-lock.ts`): `navigator.wakeLock.request('screen')` held while the student wants playback; requested on
  play (user gesture), playing, becoming visible; released on user pause, ended, give-up, unmount; re-requested if the
  browser dropped it after > 5 s held. Missing API ignored. State in `ctx.wakeLock`.
- **Progress credit**: only `timeupdate` steps 0 < d < 2.5 s while playing (not seeking/recovering). POST every ≥ 15 s if
  ≥ 1 s accrued; `sendBeacon` on pause/ended/hidden/unmount. Not sent while recovering or at `readyState 0` (a temporary
  position 0 must never overwrite real progress). Failed POST → seconds given back (≤ 40) for the next send.
- **Watch marker** (crash/relaunch detection): the player writes `ds-watch` (localStorage + sessionStorage)
  `{sid, videoId, pos, at, vis, playing, standalone, build, clean:false}` on play, every 5 s, on pause/visibility;
  `clean:true` on pagehide/ended/unmount; and holds Web Lock `ds-watch:<sid>`. `WatchMarker.tsx` (panel layout): an unclean
  marker < 15 min old whose lock is no longer held → `abnormal-exit` (detail
  `playing|paused vis=<prevVis> gap=<s>s nav=<type> [same-tab] [pwa-relaunch] [discarded]`); if it was playing, banner
  «پخش ویدیو نیمه‌کاره ماند» + «ادامه‌ی تماشا» (not on watch pages). Cosmetic quirk: the banner can show `resume.title`, but the
  player never writes `title` into the marker.
- **In-app browsers** (`IN_APP_RE` in `src/lib/playback-log.ts`, also used by `playback-store.ts`: Telegram, Eitaa, Rubika,
  Bale, Instagram, FB, `; wv)` WebView): `InAppHint.tsx` shows
  «برای پخش بهتر، سایت را در Chrome یا Safari باز کنید» with a copy-link action. Nothing more can be done from a page.

## 4. Threshold cheat sheet

| what | value | where |
|---|---|---|
| Link lifetime | `max(60, expireMinutes)` min, default 360 | settings.ts, arvan.ts |
| Cache reuse | ≥ `min(0.9·ttl, max(ttl/2, 2 h))` left | arvan.ts `getPlayback` |
| Mint dedupe | 1 per video per 10 s (if > 60 s left) | arvan.ts |
| Fresh throttle | 1 per user+video per 15 s | play route |
| Arvan API timeout | 15 s (`arvanFetch`), 20 s (`arvan-api` json) | |
| Initial /play fetch | 20 s | VideoPlayer |
| Fresh link fetch | 15 s | VideoPlayer `fetchLink` |
| Refresh delays / loop | 0, 16, 32 s / ≥ 3 in 120 s → give-up | `REFRESH_DELAYS` |
| Renew on 4xx | if fatal, playlist, or < 10 min left | `onHlsError` |
| Pre-refresh | < 3 min left on play | `onPlay` |
| Rebuild on same link | if > 5 min left; background refresh after 30 s | `doRefresh` |
| Network retries | > 6 → give-up; backoff ≤ 15 s | `onHlsError` |
| Media recover | > 3 errors/min → refresh | `recoverMedia` |
| Hung fragment | 10 s no bytes, kicks ≥ 20 s apart, ahead < 20 s | hls-watchdog |
| Frozen with data | nudge 6 s, recover 15 s | hls-watchdog |
| No data | hls-stall at 40 s stuck + 30 s no bytes | hls-watchdog |
| Recovery stuck | 30 s without canplay + 20 s no bytes | `checkRecoveryStuck` |
| Native stall | 40 s (tick 4 s) | native watchdog |
| Good playback resets budgets | 20 s | player + watchdog |
| Deferred give-up | if > 3 s buffered; cancel at +8 s; fire at < 1 s ahead / 5 s frozen | `giveUp` |
| Auto-retry | 30 / 60 / 120 s, ≥ 10 s apart, visible only | `AUTO_RETRY_DELAYS` |
| Quality demotion | ≥ 3 stalls or > 5 s in 60 s; or 15 s waiting; or kick #2 | `checkDemote` |
| Badge / long-stall | 4 s / 15 s | `onWaiting` |
| Buffers | 30 / 60 fwd, 30 back | `createHls` |
| Progress | every 15 s; delta ≤ 40; step < 2.5 s | player + route |
| Watch marker | every 5 s; abnormal-exit window 15 min | WatchMarker |

## 5. Telemetry

### 5.1 Client
- `src/lib/playback-log.ts`: `BUILD = NEXT_PUBLIC_BUILD_SHA`; `logPlayback` adds `at` + `eid` (UUID) before the first send;
  `sendBeacon` on pagehide; offline/5xx/network → localStorage queue `ds-tlm-q` (max 20, newest kept); 4xx dropped.
  `flushPlaybackQueue` on player mount, panel mount, `online`, visible. `platformCtx()`: standalone, inApp, iOS version,
  visibility, online, `navigator.connection` (`net {t,e,d,r,s}`), memory, cpu.
- `player/telemetry.ts` `createReporter`: per player session **3 per kind, 25 total**; `session-end` unlimited, `giveup`
  up to 5 outside the caps; ctx trimmed to ≤ 1800 chars (`cut:1` drops player ctx, `cut:2` drops `x`).
- Player ctx keys: `rs` readyState, `ns` networkState, `paused`, `wantPlay`, `ahead`, `ranges`, `fs`, `wakeLock`, `idleSec`
  (since last user touch), `linkLeftSec`, `refreshes`, `netTries`, `lastErr`, `frames {dropped,total}`, `engineWhy`,
  `hls {h, kbps, auto, bwKbps, buffering, cap}`, `frag {sn, level, loaded, total, ttfbMs, sinceStartMs, sinceLastByteMs}`, `build`.
- `session-end` summary: sent on pagehide (beacon), 30 s after the page is hidden, and on unmount; contains only
  increments since the previous summary (`x.seq`; the admin page sums rows per session): `playedSec, wallSec, stalls,
  stallMsTotal, maxStallMs, openStallMs, refreshes, giveups, autoRetryFails, mediaRecovers, fragStalls, qualityChanges,
  fsEnters, maxAhead, errHist (top 8 non-fatal hls errors), startupMs, firstPlayMs`.

### 5.2 Server
- `POST /api/playback-log`: logged-in only (401; DB down during auth → 503). Body ≤ 64 000 chars (413), `{events: 1..20,
  build?}`; zod per event (`kind` `/^[a-z0-9-]{1,40}$/`, `sessionId` ≤ 40, `detail` ≤ 1000 → stored ≤ 300, `ctx` record,
  `eid` `/^[A-Za-z0-9-]{8,40}$/`). Quota via `admitEvents` → 429 if nothing admitted; store failure → quota released + 503.
  Contract: 2xx stored, 4xx client drops, 5xx client re-queues.
- `src/lib/playback-store.ts`: quotas per user per hour in memory: **60 normal + 30 terminal** (`TERMINAL_KINDS` =
  giveup, session-end, abnormal-exit). IP stored only as /24 (IPv4) or /48 (IPv6) from `ar-real-ip` → `x-real-ip` →
  `x-forwarded-for` (assumes Arvan sends `ar-real-ip`; unverified). `platformOf` → `ios-app | ios-safari | android-app |
  android-browser | in-app | desktop`. Strips NUL / lone surrogates (Postgres rejects them; one bad event used to loop a
  batch forever). `ctx` > 2000 chars replaced by a small summary. `eid` becomes the row id + `createMany({skipDuplicates})`
  → at-least-once without double counting. DB error → logs `[playback-log] db error` (≤ once/10 min), retries once
  without ctx/detail.
- **LOUD kinds** also print one pm2 line `[video-error] {user,video,sid,kind,engine,build,pos,since,code,fatal,detail,plat,ip,queued}`:
  giveup, abnormal-exit, frag-stall, link-suspect, refresh-bad, js-error, fatal, native-error, refresh-loop. Others are DB only.
- Legacy `POST /api/videos/[id]/error` (old open tabs): shares the quota, always logs `[video-error]`, stored with `sessionId="legacy"`.
- Retention: hourly cron deletes PlaybackEvents older than 30 days.
- `PlaybackEvent` columns: `createdAt` (UTC), `userId`, `videoId`, `sessionId`, `kind`, `engine` (hls/native/file),
  `build`, `position`, `sinceLoadSec`, `code`, `fatal`, `detail`, `ctx` Json, `ua`, `ip` (prefix), `queued`.

### 5.3 Kinds (legend with Persian labels: `src/app/admin/playback/kinds.ts`)
Tone: **bad** = the student was really affected · **warn** = a problem the player fixed itself · **info** = statistics.

| kind | tone | meaning | what to do |
|---|---|---|---|
| `session-end` | info | per-watch summary (§5.1) | sum `stalls`, `maxStallMs`, `giveups`, `playedSec` per platform |
| `giveup` | bad | overlay «تلاش دوباره» shown — what students call «بیرونم انداخت». detail `<why> cause=… deferred=Ns` | read `why` (§7.4) and the events just before it in that session (`?sid=`) |
| `abnormal-exit` | bad | page closed / app relaunched mid-watch (flags `pwa-relaunch`, `same-tab`, `discarded`; `prevVis`, `gap`) | `prevVis=hidden` + gap → OS killed a backgrounded app; check preceding `hidden-playing` and `ctx.wakeLock` |
| `frag-stall` | warn | hung segment download kicked (`idle=…s kick=N`) | many per session/network → CDN/ISP/VPN issue; kick=3 means a fresh link was needed |
| `hidden-playing` | warn | page hidden while playing (auto-lock, app switch, call) | on `ios-app` with engine `hls` → old build or override |
| `long-stall` | warn | waited ≥ 15 s for data | compare with `frag-stall`/`hls-stall`; slow network |
| `link-suspect` | warn | status 0 (online) or 4xx on load → fresh link | `net0` = CORS-less 403/429; check secure link, bindIp, clock |
| `expired-link` | info | 401/403/410 seen (` failover` = not renewed) | frequent → link lifetime/clock problem |
| `refresh-bad` | warn | fresh link fetch failed / same URL / background failure (legend text "continued with previous link" is not always what happened) | `code` 0 = our server unreachable, 502 = Arvan API failing, `text/html` = CDN challenge, `same-url` = throttle |
| `refresh-loop` | bad | 3 refreshes in 120 s → give-up | see the `refresh-bad` codes before it |
| `fatal` | warn | fatal hls.js error | look at `detail`/`code` |
| `native-error` | warn | native player error (`code` = MediaError code; 3 = decode) | — |
| `native-stall` | warn | native player frozen 40 s | — |
| `quality-demoted` | info | manual quality → auto | by design |
| `hls-resume-buffering` | info | resumed paused MMS buffering | — |
| `hls-stall` | warn | 40 s stuck, 30 s no bytes | CDN sends nothing; second one → give-up |
| `stall-buffered` | warn | frozen picture with data (`nudge` / `recover#N`) | concentrated on one video → bad file? |
| `hls-skip-hole` | info | jumped a small buffer gap | — |
| `fs-exit` | info | fullscreen closed during trouble (iPhone rebuild closes it) | — |
| `recover-stuck` | warn | recovery 30 s without canplay | — |
| `refresh-skip` | info | slow rebuild recovered before the new link arrived | — |
| `giveup-cancelled` | info | deferred give-up cancelled by new data | — |
| `retry-fail` | bad | auto-retry after give-up failed (not a new give-up) | — |
| `retry-ok` | info | recovery/retry succeeded (`manual`, `auto-timer`, `auto-online`, `auto-visible`) | — |
| `load-fail` | bad | initial `/play` failed (`code` + content-type/timeout/network) | §7.1 |
| `engine` | info | engine chosen (`hls mse`, `native ios-app`, …) | verify `ios-app` → native |
| `js-error` | bad | JS error on the watch page or an error boundary | a site bug: read `detail` |

## 6. Admin playback report

`/admin/playback` («گزارش پخش ویدیو», nav entry in `src/components/admin/AdminNav.tsx`). Query params:
`range=24h|7d|30d` (default 24h), `kind`, `video`, `user` (phone or user id), `sid` (support-code prefix, lowercase).

Shows: KPIs (sessions = distinct sessionIds with `session-end`, watch minutes, give-ups, % sessions with give-up,
frag-stalls, abnormal exits); **platform × engine** matrix (sessions, minutes, give-ups, % cut, frag-stall, abnormal,
hidden, other); **build** table (which commit phones run; old builds = tabs left open); **kinds × minute-since-load**
buckets 0–1 / 1–2 / 2–3 / 3+ (tests the "after 2–3 minutes" complaint); top troubled videos and IP /24 networks; last 100
events with expandable ctx JSON (+ ua, ip, sessionId); the legend «راهنمای رخدادها». Samples are capped at 5000 rows
(`SAMPLE`; a warning is shown).

How to use it:
1. After a deploy, confirm the build column shows the new commit. (`deploy/doctor.sh`'s `new build live: yes` only proves a
   build from 2021f2b or later; its git line proves which commit is on disk.)
2. Start with the platform × engine matrix: `ios-app` must show engine `native`.
3. Look at the minute buckets and the `frag-stall` / `giveup` / `abnormal-exit` counts.
4. When a student reports a problem, ask for the 6-character «کد پیگیری» shown on the overlay/error box →
   `/admin/playback?sid=<code>` shows that session's full trail. Or filter by `user=<phone>` (a user id works too).
   pm2 `[video-error]` lines carry `user` = the user id (cuid) and `sid` = the first 8 chars of the sessionId — never
   the phone. Map a phone to its id from the `/admin/users/<id>` URL or `SELECT id FROM "User" WHERE phone='09…';`,
   or grep the 6-character support code (it is the prefix of `sid`).
5. SQL equivalent (on the server, `sudo -u postgres psql doping`):
   `SELECT "createdAt", kind, engine, build, position, detail FROM "PlaybackEvent" WHERE "sessionId" LIKE 'abc123%' ORDER BY "createdAt";`

## 7. Troubleshooting playbook

**Always first:** `bash /opt/doping/deploy/doctor.sh` (deployed commit, build time, `new build live`, clock sync) →
`/admin/playback` (7d/30d if older) →
`pm2 logs doping --lines 300 --nostream | grep -aE "video-error|\[play\] fresh|\[arvan\]|playback-log"`
(older events: `grep -a '\[video-error\]' /root/.pm2/logs/doping-error.log | grep -a '<user id or support code>' | tail -50`).
The owner runs these and pastes the output (doctor only above its `=== log` line); you never access production yourself.
Only LOUD kinds reach pm2 (`LOUD_KINDS` in `src/lib/playback-store.ts`: giveup, abnormal-exit, frag-stall, link-suspect,
refresh-bad, js-error, fatal, native-error, refresh-loop); everything else is on `/admin/playback` only.

1. **Error box before the video starts** → `load-fail` code/detail. 401 session expired · 403 no access · 404
   unpublished/deleted · 409 no `arvanVideoId` or still converting in Arvan · 502 Arvan API call failed (pm2 `arvan` error
   line: wrong key, Arvan down, VPS can't reach `napi.arvancloud.ir`) · `text/html` = CDN challenge or nginx 502 (app down
   or mid-deploy build) · `timeout`/`network` (code 0) = phone can't reach our server.
2. **Black screen / stops after ~2–3 min** → first check the session's engine (platform × engine matrix, `engine` event).
   - **hls.js** (desktop, Android, iOS Safari tabs): minute buckets (2–3), `frag-stall` (`idle`, `kick`), `hls-stall`,
     `stall-buffered`, `long-stall`, `quality-demoted`, `session-end.maxStallMs`, ctx.frag / ctx.hls.
   - **native** (the iPhone home-screen app, `native ios-app`): there is no hung-download watchdog, no quality demotion
     and no hls-* ladder, so `frag-stall`/`hls-*` never appear. Look at `native-stall` (picture frozen 40 s),
     `native-error` (code; 3 = decode), `long-stall`, `hidden-playing` (`ctx.wakeLock=false` / large `idleSec` → screen
     auto-lock), `abnormal-exit` (`pwa-relaunch`, `prevVis=hidden`, gap), refresh/link kinds, giveup `why`, and
     `session-end.maxStallMs`. Of these only `native-error`, `abnormal-exit`, `giveup`, `link-suspect`, `refresh-bad` and
     `refresh-loop` are LOUD (pm2); `native-stall`, `long-stall` and `hidden-playing` are **DB-only** (`/admin/playback`).
   - `ios-app` + engine `hls` → old build (app left open) or a `ds-engine=hls` override.
   - E2E scenarios `ios-engine`, `native` and `wake-lock` cover what can be emulated; real iOS behaviour cannot.
3. **"Kicked out" / app restarts** → `abnormal-exit` flags; `prevVis=hidden` + gap → OS killed the backgrounded app;
   `fs-exit`. Platform `in-app` → only the hint exists; advise Chrome/Safari.
4. **«تلاش دوباره» overlay** → `giveup` detail `why`: `net-tries` (> 6 network retries; flaky net/VPN) · `refresh-loop:<reason>`
   (see preceding `refresh-bad` codes) · `stall` (CDN sent no bytes twice) · `stall-buffered` (decoder stuck; one bad file?) ·
   `media-incompatible` (codec) · `api-401/403/404` (final). Then `retry-fail` / `retry-ok` show the auto-retry outcome.
5. **Signed-link problems (403s)** → `expired-link`, `link-suspect net0`. pm2 `[arvan] clock skew` → server NTP
   (`timedatectl`); `[arvan] signed expiry differs` → Arvan applies a different expiry; `bindIp` on behind the CDN → 403s
   (turn off); channel secure link misconfigured; `ctx.linkLeftSec` near 0.
6. **Many `[play] fresh` lines** → recovery storm; `throttled:true` = 15 s limiter; high `ms` = slow Arvan API.
7. **Stutter / quality flips** → `quality-demoted` (by design), `session-end.stalls`, `ctx.hls.bwKbps`, `ctx.net.e`, top networks.
8. **Progress/points not recorded** → recovery suppresses reports; caps (40 s per report, watched ≤ max(3×dur, 600));
   completion = 80 % watched AND position ≥ 75 %; `durationSec` 0 is learned from the player.
9. **`/admin/playback` empty** → `doctor.sh` "new build live"; events need a logged-in user; quotas 60 + 30 per user per
   hour (reset on restart); pm2 `[playback-log] db error`; 30-day retention.
10. **`/admin/arvan-videos` error** → API key missing/invalid (Settings). Duration 0 after attach → video was converting; edit later.
11. **Import failures** → `pnpm tg status`, `bash deploy/tg-import.sh log`; rerun resumes; «آپلود در آروان منقضی شد» → that
    upload restarts from 0; disk full → `--stream`.
12. **Engine A/B on one device** → `localStorage.setItem('ds-engine','native'|'hls')`, reload; `removeItem` to reset.
    Only on a device whose console you can reach; `native` needs `canPlayType(HLS)`; the iOS home-screen app has storage
    separate from Safari (Mac Safari Web Inspector needed). See §3.2.

Reproduce locally before changing the player: the E2E harness has a scenario for most of these (`hung-fragment`,
`cors403`, `always403`, `api-outage`, `html-fresh`, `frozen-a/b`, `outage`, …) — see [TESTING.md](TESTING.md).

## 8. Admin pages for video

- **`/admin/arvan-videos` «ویدیوهای آروان»** (`page.tsx`, `actions.ts`): lists all videos in all Arvan channels via the API
  on every load; Telegram import progress (VideoImport rows, `AutoRefresh` 15 s while DOWNLOADING/UPLOADING, totals in GB,
  failed rows; «پاک کردن گزارش» deletes DONE/FAILED rows). **Unlinked** videos (no `Video.arvanVideoId` points to them) are
  sorted by Telegram message order from `VideoImport.sourceKey`. **Gotcha: clearing the import report loses that ordering —
  clear it only after all videos are attached.** Per row: thumbnail, Arvan status, title, topic select (grouped by grade),
  «رایگان», «نمایش», «افزودن». `attachArvanVideo` rejects already-linked ids, takes duration/thumbnail from the list (else
  `getPlayback()`; fails silently while converting), creates the `Video` with `order = last + 1`, renames the Arvan title to
  the site title (best effort), revalidates. It sends **no** new-video notification or SMS (only `saveVideo` on create can).
- **`/admin/topics/[id]`**: `saveVideo` — Arvan id or direct URL; duration `mm:ss` / `h:mm:ss` (blank → auto via
  `getPlayback`, also sets thumbnail); `isFree`, order, published; on create optional «پیامک ویدیو جدید» (in-app notification
  + `video_new` bulk SMS to approved students of that grade). `deleteVideo` removes only the site row, not the Arvan video.
- Selling caveats: a «رایگان» video still requires login (`/courses/[id]` links to `/login?next=…`; `canWatch` = isFree or
  access). A published topic with price 0 has no single-sale buy button («فروش تکی این مبحث فعال نیست») and is sold only via a
  bundle (`resolveItem` rejects price ≤ 0). Approved class students see every topic while `access.studentsAllGrades` is on
  (default). Step-by-step owner recipe: [OPERATIONS.md §15](OPERATIONS.md#15-admin-recipes-owner-tasks-in-the-admin-panel-no-deploy-needed).
- **Settings → «ویدیو — ابر آروان (VOD)»**: API key (masked; blank keeps it), link lifetime minutes (min 60, suggest 360),
  secure link, bind IP (with a warning), watermark. Save → clears the link cache and tests `GET /channels`.
  Settings → «دسترسی شاگردان» holds `showStudentNames` (leaderboard privacy).

## 9. Telegram → Arvan import (`scripts/tg.ts`)

Moves videos from a Telegram chat to Arvan **server-side** (the owner's internet in Iran is too slow to download/upload
~38 GB). Finished for the first 53 videos; kept for reuse.

- Data dir: `TG_DATA_DIR` or the parent of `UPLOAD_DIR` (server `/var/lib/doping`). Session file `.telegram-session.json`
  (mode 0600; holds api_id/api_hash/session = **secret**, deleted by `logout`). Temp dir `tg-tmp/` with `.lock` (one import at a time).
- Commands (`pnpm tg <cmd>` in `/opt/doping`): `login` (interactive on the server: api_id, hidden api_hash, phone, Telegram
  code, hidden 2FA — the owner types these, never in chat), `logout`, `chats`, `videos <chat> [--all]`,
  `import <chat> [--all] [--limit N] [--parallel N] [--stream] [--channel ID] [--profile ID]`, `status`.
  `<chat>` = numeric id, `@username` or phone.
- Only videos sent by the other side unless `--all`; skips GIFs/round videos. Title = first caption line or filename
  (short/numeric → `ویدیو <n> - <t>`).
- `--parallel` default 2; max 4 with disk, 10 with `--stream`. Disk mode: 16 MB segments × 4 workers, `.parts` resume
  file, free-space check. `--stream` (diskless): fetches exactly the range each TUS chunk needs (512 KB-aligned) with
  prefetch. Arvan caps each upload connection at ~0.5 MB/s, so parallelism raises throughput.
- Resume: `VideoImport.uploadUrl` (TUS) is kept; the offset is re-checked (HEAD up to 8 × 15 s) else the upload restarts.
  After upload `createVideo` (auto convert) → DONE + `arvanVideoId`. Errors → FAILED; rerunning the same command resumes;
  DONE rows are skipped (unique `sourceKey = tg:<chatId>:<messageId>`). Progress written every 10 s (shown on
  `/admin/arvan-videos`). Exit codes 0 / 2 (some failed) / 130 (signal). Reads the Arvan key from the DB.
- Background wrapper: `bash /opt/doping/deploy/tg-import.sh <chat> [import flags]` (nohup, `nice -n 15`, log
  `/var/lib/doping/tg-import.log`, pid `/var/lib/doping/tg-import.pid`); `… log` tails; `… stop` kills by PID.
- History (owner facts): creating a Telegram api_id at my.telegram.org did not work from Iran; a reuse needs an
  api_id/api_hash that the owner types on the server during `pnpm tg login` (never in chat). All 53 lesson videos (~38 GB) were transferred on 1405/7/21 with `--stream --parallel`; the session was logged out
  (`pnpm tg logout`). Open: attach them to topics, delete `test-720p` and the duplicate, Arvan temp files and
  `/var/lib/doping/tg-tmp` ([TODO.md](TODO.md)).

## 10. Arvan settings and secure link

- Plan: Growth; channel «doping shimi». The channel's **Secure Link must be enabled** in the Arvan panel, and real playback
  must be tested on real phones (still open).
- Parameters (`mint`): `GET /videos/{id}?secure_expire_time=<unix seconds>[&secure_ip=<ip>]`. Per Arvan's OpenAPI spec the
  default is 24 h if omitted; the code always sends it when `secureLink` is on. Real expiry behaviour has not been
  confirmed against production (check: open an expired URL → expect 403).
- `expireMinutes`: min 60, default 360. Shorter links mean more `?fresh=1` traffic over the slow international path.
- **Keep `bindIp` off**: behind the CDN, `clientIp()` is probably the edge IP while segments are fetched from the phone's
  IP → 403s; mobile IPs also change.
- The server clock must be NTP-synced (expiry is computed from it); `doctor.sh` shows sync, the app logs `[arvan] clock skew`.
- The API key currently has broad (Workspace owner) rights; replace it with a video-only role if Arvan offers one ([TODO.md](TODO.md)).
- Useful Arvan features for later: media profiles (`--profile`), live streaming, DRM. Small UI idea: show
  `secure_link_enabled` per channel in the Settings "test connection" result (field already typed in `arvanChannels()`).

## 11. Known residual issues and ideas

Verified only in the local E2E harness (Chromium emulation); **never on real phones; production logs never seen by an AI;
deployment of da72570 unknown at handoff.**

- Three back-to-back hung segments still freeze ~45–60 s (10 s idle + 20 s kick gaps).
- A permanently frozen picture reaches the give-up overlay only after ~130 s (E2E `frozen-b`).
- In-app messenger browsers only get a hint banner.
- Deploy builds in place → brief outage; players show HTML `load-fail` (reload button) during it.
- In-memory limits/caches reset on restart.
- The `playerUrl` iframe path has no telemetry/progress/watermark.
- WatchMarker banner title is never set (cosmetic).

Act on these only after real telemetry shows they matter. Possible next steps: tighten the kick gap for consecutive hung
segments; shorten the frozen-picture ladder; atomic deploys (OPERATIONS.md §Ideas).
