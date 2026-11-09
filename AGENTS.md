<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project handoff — دوپینگ شیمی

Entry point for any AI or developer continuing this repo. Read this section, then the docs it links. Everything here was
checked against commit `da72570` plus the E2E harness in `tests/e2e/` on 2026-11-08 (1405/8/17).

## What this is

- «دوپینگ شیمی» (https://dopingshimi.ir): cinematic public site + installable PWA + student panel + admin panel for the
  chemistry teacher «استاد جواد پرتویی» (Mashhad). His degree is «کارشناسی ارشد مهندسی شیمی», never «لیسانس»
  (`prisma/data-fixes.ts` enforces it in the DB).
- Students buy topics/bundles (card-to-card with manual admin approval for now), watch lessons streamed from ArvanCloud
  VOD with signed links, take in-site or «پلکان» exams, and earn points and levels. The teacher manages classes, SMS, exams, content and payments.
- Stack: Next.js 16.3.6 App Router (breaking changes, see the block above), React 19, Tailwind v4, Prisma 7 (client
  generated into `src/generated/prisma`, gitignored), PostgreSQL, pnpm 10, Node ≥ 20.9 (Next 16 minimum; the server runs 22). TypeScript strict.
- UI text and code comments are in Persian; agent docs are in English. Owner/developer: Ramin Omrani (`RaminOmrani/DopingShmi`).

## Branch and deploy model

- **The only branch is `claude/dazzling-meitner-g7mbwp`** (there is no `main`). It is the production source: the server
  checkout at `/opt/doping` tracks it, and `deploy/install.sh` defaults `BRANCH` to it.
- Pushing to it = what production gets the next time the owner runs `bash /opt/doping/deploy/update.sh`
  (pull --ff-only → install → `db:push` → seeds/fixes → `pnpm build` in place → `pm2 reload doping`).
- Commit and push only when the owner asks. No PRs unless asked. Never force-push or rewrite history (the server's
  `pull --ff-only` would break); roll back with `git revert`. Commit messages in clear English.
- No CI and no `prisma/migrations`: schema ships via `prisma db push`, so schema changes must stay additive.
- If your session runs on another branch (agent tools often create one per session), fast-forward or merge your commits
  into `claude/dazzling-meitner-g7mbwp` and push that branch with the owner's OK; otherwise production never gets them.
  Don't create `main`; don't open a PR unless asked.
- **If `docs/` or `tests/e2e/` is missing in your clone, this handoff was never pushed.** Check with
  `git ls-files docs tests/e2e | head`, and tell the owner (the files exist only in an earlier session's working copy).

## HARD RULES

1. **Talk to the owner in Persian.** He is not an ops person. He runs every server command himself and pastes the
   output back. Give exact copy-paste commands, one step at a time, and say what each one does. You have no SSH or
   production access: never contact `dopingshimi.ir` or the server yourself.
2. **The server is shared.** The Swedish Ubuntu VPS also hosts «ذهن سبز» (Zehn Sabz) and other services; ports 3000 and
   4310 are theirs. Touch only pm2 app `doping`, nginx site `doping`, DB `doping`, `/opt/doping`, `/var/lib/doping`.
   Never run: `pm2 … all`, `systemctl restart nginx|postgresql`, edits to other nginx sites or ufw, `apt upgrade`,
   re-running install.sh, **`do-release-upgrade`**, timezone changes, `pnpm dev`/`pnpm start` on the server (port 3000),
   **the E2E harness (`tests/e2e`, `pnpm e2e`) or `prisma/seed.ts --demo` on the server** (they write test/demo rows into the
   live DB, which is on 127.0.0.1 so the harness's local-DB guard passes). Reboot only at a quiet hour with his OK.
3. **Deploy outside study hours.** update.sh builds in place: the site is down or 502 for a few minutes, and stays down if the build fails.
4. **Secrets.** Never ask the owner to paste keys, passwords, api_id/api_hash or tokens into chat. He enters them in
   Admin → «تنظیمات» (stored in the DB `Setting` table) or types them on the server. Never print or commit secrets
   (`Setting.value`, `.env`, `db.pass`, JWTs, Telegram session). The *production* `.env` values (DATABASE_URL,
   AUTH_SECRET, PORT, UPLOAD_DIR, SITE_URL, optional INSECURE_COOKIE) exist only on the server; local dev needs its own
   `.env` copied from `.env.example` (gitignored). The repo is **public**: no account identifiers or secrets in commits.
5. **Zehn Sabz:** never read or try to obtain its files or credentials. **Do not change the melipayamak main account
   password** (it is shared with Zehn Sabz).
6. **Never `pkill -f <pattern>` or `killall node`.** A pattern that also appears in your own command line kills your
   shell. Kill by PID or PGID (`tests/e2e/ctl.sh` does this).
7. **One process only.** Keep pm2 at a single fork instance (that is a pm2 default; `deploy/ecosystem.config.cjs` doesn't
   pin it, so never `pm2 scale doping`). The link cache, rate limits, telemetry quotas and the hourly cron
   (`src/instrumentation.ts`) live in memory, so cluster mode would duplicate cron and SMS. The cron also starts in any
   local `next dev`/`next start`: never run the app against a copy of the production DB (real SMS would go out).
8. Every admin page calls `await requireAdmin()` itself, because layouts don't re-run on client navigation. Every
   `"use server"` export checks `isAdmin` itself (use `adminAction`).
9. Schema changes must be additive. On a destructive diff, `db push` in update.sh **asks** «Do you want to ignore the
   warning(s)?» when the owner runs it in an SSH terminal (it aborts only when non-interactive): tell him to answer **No**
   and paste the output; yes = data loss. Data migrations go in the idempotent `prisma/data-fixes.ts`. Add no new
   dependencies without need, and always commit `pnpm-lock.yaml`.
10. Admin login is 09158148172 with the seed default password documented in README. That password must be changed in
    production; never write a real password anywhere.

## Read next

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the code map. Routes (pages and API, with auth), data model, settings keys, auth,
  access and purchase, points, exams, SMS, SEO, PWA and service worker, cron, uploads, env vars, scripts, conventions.
- [docs/VIDEO.md](docs/VIDEO.md): the video system end to end. Arvan signed links, player design and thresholds, telemetry kinds,
  how to use `/admin/playback`, troubleshooting playbook, Telegram import. **Read it before touching the player.**
- [docs/OPERATIONS.md](docs/OPERATIONS.md): the server layout, deploy/doctor/backup/restore/rollback, logs, safe vs forbidden
  commands, local dev setup, gotchas, admin recipes (paid topic + videos, points, SMS setup).
- [docs/TESTING.md](docs/TESTING.md): typecheck, build, the E2E harness, and what is verified vs not (no real devices yet).
- [docs/HISTORY.md](docs/HISTORY.md): changelog with commits and dates, decision log, unverified assumptions, README drift.
- [docs/TODO.md](docs/TODO.md): open items (Persian; the owner's own list).
- [tests/e2e/README.md](tests/e2e/README.md): full reference for the E2E harness.
- [README.md](README.md): owner-facing Persian overview. Parts are stale (see HISTORY.md §4).

## How to verify a change

```bash
pnpm install
pnpm exec next typegen      # fresh clone only (next-env.d.ts and .next/types are generated)
pnpm typecheck              # tsc --noEmit
pnpm build                  # needs a reachable local Postgres with the schema pushed
pnpm e2e quick              # if you touched the player, telemetry, /api/videos, the panel shell or the SW
```
The E2E setup (mock Arvan API and CDN, Playwright) is in [docs/TESTING.md](docs/TESTING.md). Keep `"tests/e2e"` in the
`tsconfig.json` `exclude`: its generated `.ts` video segments would break typecheck. Follow the conventions in
ARCHITECTURE.md §20: Persian UI and comments, `server-only` libs, `route()` handlers with zod, `adminAction` server actions.

## Current status (2026-11-08)

- **Video saga:** after reports of "black screen / stops after 2–3 minutes / kicks students out", the player was
  rewritten and hardened across 9 commits (`62136f9` → `da72570`). The work added a hung-download watchdog, native HLS
  plus Wake Lock for the iOS home-screen app, refresh resilience, auto-retry, quality demotion, smaller buffers, and
  first-party telemetry shown at `/admin/playback`. **It was verified only in the local E2E harness, never on real
  phones.** Production logs were never seen by an AI, and it is unknown whether `da72570` is deployed.
- SMS is still on the `mock` provider until the owner enters the melipayamak key. In production, OTP codes are then only logged.
- Payments are card-to-card with admin approval. Zarinpal comes after «اینماد».
- 53 lesson videos (~38 GB) are in Arvan (imported from Telegram on 1405/7/21) but are not yet attached to topics.
- SEO pages, articles and JSON-LD are done. GSC is verified. The off-site checklist is in TODO.md.

Top open items (details in [docs/TODO.md](docs/TODO.md); who acts in brackets):
1. [owner] Keep the admin password off the seed default (Admin → «تنظیمات» → «تغییر رمز», or the reset in
   [OPERATIONS.md §8](docs/OPERATIONS.md#8-secrets-and-the-admin-password)).
2. [owner runs, AI checks] Deploy `da72570`+ at a quiet hour (backup first), then `deploy/doctor.sh`: the git line must show
   the expected commit, BUILD_ID fresh, pm2 uptime after the build, clock synced. `new build live: yes` alone only proves 2021f2b+.
3. [owner collects, AI analyses] After real use: `/admin/playback` and the pm2 lines `[video-error]`, `[play] fresh`, `[arvan]`.
4. [owner/teacher/students] Real-device checks: iPhone Safari, the iPhone home-screen app, Android Chrome and PWA, an in-app browser.
5. [owner, Arvan panel] Enable the channel secure link and test real playback. Keep `bindIp` off.
6. [owner/admin] Attach the 53 videos in `/admin/arvan-videos`, delete `test-720p`, the duplicate and the Arvan temp files,
   set prices and bundles (recipe: [OPERATIONS.md §15](docs/OPERATIONS.md#15-admin-recipes-owner-tasks-in-the-admin-panel-no-deploy-needed)).
7. [owner] SMS setup: provider, key, sender line, server IP whitelist, test; re-register rejected templates without links
   and enter their codes in `/admin/sms`.

## First 15 minutes (checklist for a new AI)

1. Read this file, then [docs/TODO.md](docs/TODO.md) and the top of [docs/VIDEO.md](docs/VIDEO.md).
2. Run `git status`, `git log --oneline -15` and `git ls-files docs tests/e2e | head`. Confirm you are on (or will merge into)
   `claude/dazzling-meitner-g7mbwp`, that the docs are tracked, and see what changed since `da72570`.
3. Skim the Next 16 docs in `node_modules/next/dist/docs/` for anything you will touch (async `params`, `retry` in error boundaries).
4. Set up locally per [OPERATIONS.md §11](docs/OPERATIONS.md#11-local-development-from-scratch), then run `pnpm typecheck` and `pnpm build`.
   For demo data use `pnpm exec tsx prisma/seed.ts --demo` (not `pnpm db:seed -- --demo`).
5. Ask the owner in Persian what he wants now, and whether `da72570`+ is deployed. If it is, ask him to paste the
   `deploy/doctor.sh` output **only above the `=== log (last 40)` line** (the log tail can hold phone numbers and
   `[sms:mock]` OTP codes) and a screenshot or summary of `/admin/playback`. Never request secrets.
6. Before changing video code, reproduce the case with an E2E scenario (`node tests/e2e/run.mjs list`).
7. Before giving the owner any server command, check it against HARD RULES 2–6 and [OPERATIONS.md §2](docs/OPERATIONS.md#2-shared-server-safe-vs-forbidden).
