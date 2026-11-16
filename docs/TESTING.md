# Testing and verification

What exists, how to run it, and — just as important — what has **not** been verified. Checked 2026-11-08 at `da72570`
plus the (uncommitted at the time of writing) harness in `tests/e2e/`.

Related: [AGENTS.md](../AGENTS.md) · [VIDEO.md](VIDEO.md) · [OPERATIONS.md §11](OPERATIONS.md#11-local-development-from-scratch) (local setup) ·
**[`tests/e2e/README.md`](../tests/e2e/README.md)** (full harness reference).

## 1. What exists

| check | command | covers |
|---|---|---|
| Type check | `pnpm typecheck` (`tsc --noEmit`) | whole repo except `node_modules` and `tests/e2e` |
| Production build | `pnpm build` (`prisma generate && next build`) | compile, prerender (needs a reachable, pushed local DB) |
| E2E playback harness | `pnpm e2e <scenario|group>` (`node tests/e2e/run.mjs`) | real production build + local DB + mock Arvan API/CDN, Playwright Chromium with phone emulation |
| Chemistry/content unit tests | `pnpm test:chem` (node:test via tsx, no framework) | `src/lib/chem` engine, Chem tokenizer, route registry, chapter/quiz/tool/formula content validators and render tests (132 tests at 1405/08/25) |
| SEO check | `pnpm seo:check http://127.0.0.1:3341` against a local `pnpm exec next start -p 3341` | every sitemap URL (or `--planned` / `--paths`): status, canonical, title/description, H1, OG/Twitter, JSON-LD `@id`s, noindex, Persian letters, internal links ([ARCHITECTURE §14](ARCHITECTURE.md#14-seo)) |

There is **no CI** (`.github/` doesn't exist), no unit-test framework beyond node:test, and no lint step (Next 16 removed `next lint`; there
is no ESLint config). The baseline for any change is `pnpm typecheck` + `pnpm build`; for anything touching the player,
telemetry, the panel shell, the service worker or `/api/videos/*`, also run E2E. For any public page or content change, also
run `pnpm test:chem` and `pnpm seo:check` (above). Note: the E2E `admin` scenario needs `abnormal-exit` rows from the last 24 h,
so run `crash` (or `pwa-relaunch`) before it on a fresh DB, or its `kindFilter` check fails.

Fresh clone: run `pnpm exec next typegen` (or one `pnpm build`) before `pnpm typecheck` — `next-env.d.ts` and
`.next/types` are generated and gitignored.

**Keep `"tests/e2e"` in the root `tsconfig.json` `exclude`.** The generated test video in `tests/e2e/vod/` consists of
MPEG-TS segments ending in `.ts`; the `**/*.ts` include would pick them up and break `pnpm typecheck` and `pnpm build`.

## 2. The E2E harness (`tests/e2e/`)

Built while fixing the video "black screen / stops after 2–3 minutes / kicks students out" problem (commits `62136f9` …
`da72570`), originally in an AI scratchpad, then ported into the repo. It reproduces the field failures against the real
app:

- **App under test**: `.next` production build started by `tests/e2e/ctl.sh app` on **:3310** with
  `ARVAN_API_BASE=http://127.0.0.1:3399/vod/2.0`, using the **local** PostgreSQL from the repo `.env` (refuses non-local DBs,
  and refuses to run at all on the production server: `/opt/doping`, `/var/lib/doping` or the nginx site `doping`).
  **Never run it on the server**: the production DB is on 127.0.0.1 too, so the local-DB check alone would pass.
- **Mock Arvan VOD API** (`servers.js arvan`, **:3399**) and **mock CDN** (`servers.js hls`, **:3600**) serving a generated
  3-level HLS stream. The CDN can expire links, send 403 with or without CORS, 500s, drop connections, corrupt segments,
  serve an undecodable segment, and hang downloads mid-body or before headers (`/control?ns=…`).
- **Scenarios**: `set1.js` (core playback + regressions), `set2.js` (platform, telemetry, app shell, admin report),
  `scenarios/frozen.js`, `scenarios/outage.js`; `run.mjs` = runner with 33 names and groups `quick` (2), `video` (15),
  `platform` (14), `all` (33, ~1.5 h sequential). Exit codes: each suite (`set1.js`, `set2.js`, `scenarios/*.js`) exits
  0 pass / 1 fail / 2 harness error; `run.mjs` exits with the **number of non-passing scenarios** (2 on a preflight error,
  0 for `list`), so a run with 2 failures and a harness error look the same — read the summary.
- **Isolation**: slot n (1..20) owns test student `0915900000n`, a test video and a mock namespace, so scenarios with
  different slots can run in parallel (`--parallel`; the runner refuses shared slots).
- Talks only to the local DB and the mocks, never to real Arvan or dopingshimi.ir, as long as it runs on a dev machine
  (see the production-server guard above). Ports 3000/3200/4310 are deliberately avoided.

Run from a fresh clone (needs Node ≥ 20.9, pnpm 10, PostgreSQL + psql, ffmpeg with libx264 + aac, setsid, curl):
```bash
service postgresql start                       # or however Postgres runs locally
sudo -u postgres psql -c "CREATE USER doping WITH PASSWORD 'doping';" -c "CREATE DATABASE doping OWNER doping;"   # once
cp .env.example .env                           # once; DATABASE_URL must point at the local DB
pnpm install
pnpm db:push && pnpm exec tsx prisma/seed.ts --demo && pnpm db:seed-articles   # once (demo student 09150001000)
pnpm build                                     # needs the pushed DB; rebuild after every src change (ctl.sh serves .next)
tests/e2e/gen-vod.sh                           # ~1–3 min, needs ffmpeg; skip if vod/ exists
(cd tests/e2e && npm install && npx playwright install chromium)   # skip in Claude cloud containers (preinstalled)
node tests/e2e/setup.mjs                       # idempotent: test users/videos, test Arvan key, 7-day JWTs in .run/
tests/e2e/ctl.sh up                            # mocks + app; refuses ports already in use
node tests/e2e/run.mjs list                    # every scenario: slot, duration, what it checks
node tests/e2e/run.mjs quick                   # hung-fragment + always403 (~4 min each)  (= pnpm e2e quick)
tests/e2e/ctl.sh all-stop                      # stops everything by process group (never pkill -f)
```
Notes: `pnpm db:seed -- --demo` does **not** create the demo student (OPERATIONS.md §12). Playwright is preinstalled in
Claude cloud containers (`/opt/pw-browsers/chromium`, version 1.63.0, the version `tests/e2e/package.json` pins).
`setup.mjs --clean` removes all test rows.

Results: `tests/e2e/results/<suite>/result-<name>.json` (verdicts, 1 s timelines, CDN request log, telemetry rows,
progress row) + console logs; app server log in `tests/e2e/.run/app.log` (same `[video-error]`, `[play] fresh` lines as pm2).
Generated/gitignored: `vod/`, `.run/`, `results/`, `node_modules/`. Scenario table with pass criteria, mock controls,
timeline format and troubleshooting: [`tests/e2e/README.md`](../tests/e2e/README.md) §6–§12.

Adding a scenario: copy an entry of `SC` in `set1.js` (or a file in `scenarios/`), use a free slot (`run.mjs list`), add
the alias to `run.mjs` and a row to the README table.

## 3. What has been verified

| when | what | result |
|---|---|---|
| 2026-10-26 … 10-28 (commits 62136f9 → da72570) | scratchpad harness, ~30 scenarios on the `da72570` code (mobile emulation, throttling, 4 vCPU container) | passed; the few failures were harness artifacts, fixed during the port (see tests/e2e/README §9) |
| 2026-11-08 (port into `tests/e2e`, build `da72570`) | `hung-fragment`, `always403` (error screen after 50.4 s, auto-retry after 29.2 s, progress not reset), `b-long`, `wake-lock`, `pwa-relaunch`, `frozen-a`, `outage` | passed |
| 2026-11-08 | the other ported scenarios | **not re-run** since the port (only paths/build detection changed) |
| every commit so far | `pnpm typecheck` + `pnpm build` | passing at `da72570` with `tests/e2e` excluded |

## 4. What has NOT been verified (state this honestly to the owner)

- **No real phone has run the fixes.** Chromium cannot emulate iOS: native HLS (AVPlayer), ManagedMediaSource behaviour,
  real Screen Wake Lock, auto-lock, iOS killing a home-screen PWA. `ios-engine` only checks the engine *choice* with faked
  `navigator.standalone` / `canPlayType`; Wake Lock is a JS fake.
- Throttling is CDP emulation, not a real radio or the real Iran ↔ Sweden international link.
- Real Arvan secure links (expiry behaviour, whether the channel toggle is needed), Arvan CDN edge behaviour (HTML
  challenges, `ar-real-ip`), and per-connection download limits.
- **Production**: the AI has never seen production logs or the DB; whether `da72570` is deployed was unknown at handoff;
  whether `/admin/playback` has data yet is unknown.
- SMS (melipayamak) end to end, Zarinpal, backup restore — never tested in production.
- The Next 16 "layouts don't re-run on client navigation" basis for per-page `requireAdmin` (83c18bf) comes from docs and
  reasoning; there is no exploit reproduction.

## 5. Real-device checklist (for the owner, after deploying da72570+)

Ask the owner (in Persian) to watch a full lesson on each, with the screen left alone for > 3 minutes, then check
`/admin/playback` for that session (`?user=<phone>`):
1. iPhone, Safari tab (expect engine `hls`).
2. iPhone, home-screen app (expect engine `native`, no black screen on auto-lock window, `hidden-playing` only if he locks it).
3. Android Chrome tab and the installed PWA.
4. A messenger in-app browser (Telegram/Eitaa/Bale) — expect the hint banner.
5. An expired link: wait past `expireMinutes` (or temporarily set 60) mid-video → expect `expired-link` / silent refresh, no overlay.
Collect any «کد پیگیری» shown and the build column. See [TODO.md](TODO.md).
