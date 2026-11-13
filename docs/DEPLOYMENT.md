# Deployment plan — Morkahja under babuni.dev

**Status:** **Deployed 2026-11-10** at https://www.babuni.dev/Morkahja/ with Babuni's approval and verified live (see *Production deployment*). Babuni confirmed restoring their own pre-migration account. Open follow-ups: confirm the first real Stripe delivery at the new webhook URL, and merge the branch so the server can track `main` again.  
**Recorded:** 2026-11-09 (plan) · updated 2026-11-10 (implementation, discovery, local verification, production deployment)  
**Branch:** `feat/babuni-dev-subpath` (deployed commit `95fd5c5a`, not yet merged into `main`)  
**Target game URL:** https://www.babuni.dev/Morkahja/ (decided 2026-11-10; originally planned as `https://babuni.dev/Morkahja/`)

## Goal

Move the public game address from the former game domain to `https://www.babuni.dev/Morkahja/`, while keeping the main website at `https://www.babuni.dev/`.

Morkahja remains an independently deployable frontend and API beneath the website. The existing player database and game backend are retained. Nothing here authorizes a database reset, player-data migration or destructive deployment.

## Infrastructure discovered (2026-11-10, public read-only checks)

These observations come from public DNS lookups and unauthenticated HTTP(S) requests made from the development machine. No server was logged into and nothing was changed.

| Question | Finding |
| --- | --- |
| DNS provider | Porkbun nameservers. |
| `babuni.dev` (apex) | A records point to **Porkbun parking**. Plain HTTP returns a "Coming Soon" parking page (`Server: openresty`). **HTTPS fails at the TLS handshake**: no certificate is served for the apex. |
| `www.babuni.dev` | A separate host running `nginx/1.28.3 (Ubuntu)`. It serves the real website ("Babuni.dev — Projects, games, music and creative development") over HTTPS with a Let's Encrypt certificate whose only name is `www.babuni.dev`. |
| `/Morkahja/` on the website host | `https://www.babuni.dev/Morkahja/` and `/Morkahja/api/health` return Nginx 404. Nothing is routed yet. |
| Website security headers | Only `Referrer-Policy: strict-origin-when-cross-origin` was observed. No HSTS, CSP or frame-options header. |
| Former game VPS, PostgreSQL, PM2 | *Superseded by the server inspection below.* **Not established from public checks.** The historical root `DEVLOG.md` describes a Hetzner VPS with Nginx serving `/var/www/morkahja`, PM2 `morkahja-api` on `127.0.0.1:3000`, and PostgreSQL on localhost. No server access details were available for this work, so it is unknown whether the game still runs on that VPS or shares a host with the website. |
| Stripe | *Superseded below.* **Not established from public checks.** The repository has live price IDs and a `/stripe/webhook` endpoint. Whether production has `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` set, and which webhook URL Stripe uses, needs the server `.env` and the Stripe dashboard. |

### Decision: serve the game from `www.babuni.dev`

`https://babuni.dev/` does not serve the website today. The apex goes to the registrar's parking service and has no certificate. Given the two options (point the apex at the website host, or use the existing `www` host), **Babuni chose `https://www.babuni.dev/Morkahja/` on 2026-11-10** (see D-006 in `DECISIONS.md`). No DNS change is required for this, and none was made.

What the decision implies:

- The browser origin is `https://www.babuni.dev`. That is a **different origin** from the apex `https://babuni.dev`. If the apex is later connected to the website, redirect it to `www` (for example a 301 of `https://babuni.dev/*` to `https://www.babuni.dev/*`) rather than serving the game on both names. Otherwise players would end up with separate browser storage, and so separate local identities, per name.
- Until then, `babuni.dev/Morkahja/` shows the parking page. Links and announcements should use the full `https://www.babuni.dev/Morkahja/` address.

The rest of this document uses `www.babuni.dev`.

### Server inspection (2026-11-10, with Babuni's authorization)

- **One host** runs the website, the game and its database. Nginx serves the website from a release-symlink directory. The Morkahja API runs under PM2 as a dedicated service user on port 3000, which `ufw` blocks from outside. PostgreSQL 18 is local.
- The former domain's Nginx site is still enabled and serves a June frontend build. It was left untouched.
- Before the cutover, production ran backend commit `77062a42` (16 June 2026), 31 commits behind `main`. It did not have the server-issued session challenges the current frontend uses, so **the backend had to be upgraded together with the frontend**. The server checkout had no unpublished game-data edits, only a modified `package-lock.json` and a `node_modules.bak` directory.
- **Stripe is enabled**: the secret key and webhook secret are both set.
- The website deploy account has no `sudo`. Root steps ran through a script started by Babuni with `sudo`.

## What the repository now does

Implemented on `feat/babuni-dev-subpath` (see `CHANGELOG.md` for the file list):

- **Vite base:** Production builds and `vite preview` use `base: '/Morkahja/'`. Development (`npm run dev:client`) still serves from `/` with the unchanged root API proxies. `VITE_BASE_PATH` overrides the base when needed.
- **Testing on a phone (local network):** `npm run dev:phone` runs the dev client over https with a self-signed certificate (`client/scripts/dev-cert.sh`, stored in the gitignored `client/.dev-cert/`, renewed when the computer's network address changes). Browsers create journey keys only on secure pages, so plain `http://<computer-ip>:5173/` cannot create or restore a journey. The phone shows a certificate warning once; accept it to continue. The backend runs as usual with `npm run dev:backend`.
- **API prefix:** Production builds default `VITE_API_BASE_URL` to `/Morkahja/api` (derived from the base). An explicit `VITE_API_BASE_URL`, including an empty string, still wins. `vite preview` forwards `/Morkahja/api/*` to `127.0.0.1:3000` with the prefix stripped, which makes a local subpath check possible.
- **Runtime asset URLs:** `client/src/assetUrl.ts` prefixes root-relative public paths (`/UI/…`, `/game/…`) with Vite's `import.meta.env.BASE_URL`. Every hard-coded asset path in client source now goes through it, including dice art from `shared/src/diceCatalog.ts` and asset paths sent by the server (Scribes feed `iconUrl`, achievement `baseIconUrl`/`rankOverlayUrl`). The helper leaves absolute, `data:` and `blob:` URLs alone and never double-prefixes. The server API contract is unchanged: it still sends root-relative public paths. A regression test fails if a new unwrapped `'/UI/…'` or `'/game/…'` literal appears in client source.
- **HTML, CSS, manifest:** Vite rewrites the favicon, Apple touch icon, manifest link and the CSS font `url()` to `/Morkahja/…` at build time. `manifest.webmanifest` uses relative `start_url`/`scope` (`./`) and icon `src`, which resolve to `https://www.babuni.dev/Morkahja/` from `/Morkahja/manifest.webmanifest`. A test asserts this.
- **Social preview:** The fallback site URL is now `https://www.babuni.dev/Morkahja`. The Open Graph image previously pointed to `posterRaceSkills2.png`, which was removed from the repository earlier and would have returned 404; it now points to the existing `posterRaceSkills2.webp` (600×801, `image/webp`).
- **Express behind the proxy:** `app.set('trust proxy', …)` now defaults to `loopback`, configurable with `TRUST_PROXY`. Without it, every request through Nginx appears to come from `127.0.0.1`. The per-IP limit of 25 requests per minute on `/session/challenge`, `/session/bootstrap` and `/session/heartbeat` would then be shared by **all** players. With heartbeats every 45 s, roughly 19 concurrent players would start receiving 429s, and three consecutive heartbeat failures log a player out. The default trusts `X-Forwarded-For` only when the direct peer is loopback, so remote clients still cannot spoof their address.
- **Nginx template:** `deploy/nginx/morkahja-locations.conf.template` contains `location` blocks to include in the existing website `server {}` block, with placeholders for the web root and API upstream.

No server routes, database schema, Stripe logic or game rules were changed.

### Not changed (deliberately)

- `client/src/ui/settings/PatchNotesOverlay.tsx` mentions the former domain in a historical release note. `client/src/ui/onboarding/PrivacyPolicyOverlay.tsx` lists a contact email on the former domain. Neither is a URL the game loads. The privacy contact is a legal/notice decision for Babuni and was left as is.
- `client/public/UI/01_2_Agreement/menuBGplayerCreation.webp` is referenced by onboarding but has never been in the repository. It returns 404, and the CSS falls back to `menuBG.webp`. This predates the migration.

## Production configuration

### Frontend build (no secrets)

```sh
# From a checkout of the commit being deployed
npm ci
VITE_SITE_URL=https://www.babuni.dev/Morkahja \
VITE_API_BASE_URL=/Morkahja/api \
npm run build --prefix client
# Output: client/dist (index.html references /Morkahja/assets/...)
```

`VITE_API_BASE_URL` is already the production default; passing it explicitly documents intent.

### Server environment (`.env` beside `ecosystem.config.cjs`, never committed)

| Variable | Value | Notes |
| --- | --- | --- |
| `CLIENT_ORIGINS` | `https://www.babuni.dev` | Origins only, never paths. Same-origin requests do not need CORS; this mainly affects any cross-origin use. |
| `CLIENT_URL` | `https://www.babuni.dev/Morkahja` | Stripe returns players to `${CLIENT_URL}/?purchase=success…` / `?purchase=cancel`. |
| `TRUST_PROXY` | unset (`loopback`) | Set to the proxy's address/subnet only if Nginx runs on another host. |
| `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PORT` | unchanged | Keep the existing production values. Do not copy them into the repository or documentation. |

### Stripe (only if enabled in production)

- Webhook endpoint: `https://www.babuni.dev/Morkahja/api/stripe/webhook` (Nginx strips the prefix, so Express still receives `/stripe/webhook`). Updating the endpoint in Stripe may issue a new signing secret; if so, update `STRIPE_WEBHOOK_SECRET`.
- Verify a test-mode checkout success and cancel return to `https://www.babuni.dev/Morkahja/?purchase=…`, and a signed webhook delivery.

### Nginx

Fill in `deploy/nginx/morkahja-locations.conf.template` on the server and `include` it inside the existing `server { server_name www.babuni.dev …; }` block (the HTTPS one that holds the current certificate). Don't commit the filled-in copy. It provides:

- `= /Morkahja` → 301 to `/Morkahja/` (query string preserved). `= /Morkahja/api` → 301 to `/Morkahja/api/`.
- `^~ /Morkahja/api/` → `proxy_pass http://127.0.0.1:3000/;`. The trailing slash replaces the matched prefix, so `/Morkahja/api/health` reaches Express `/health`. Method, body, query string and `Authorization` pass through. Being the longest `^~` prefix, it wins over the SPA location, so unknown API paths return Express JSON (401/404), never HTML.
- `^~ /Morkahja/` → `root <parent>` where `<parent>/Morkahja` is the current release. `/Morkahja/assets/` is immutable-cached. `/Morkahja/UI/` and `/Morkahja/game/` return a real 404 for missing files. The manifest is served as `application/manifest+json`. Everything else falls back to `/Morkahja/index.html` (no-cache).

**Header inheritance warning:** Nginx drops all `add_header` directives inherited from the `server` block in any location that sets its own `add_header`. The asset, manifest and index locations set `Cache-Control`. If the website's server block later adds security headers (HSTS, CSP), repeat them in these locations or move them into a shared `include`.

## Deployment procedure (as executed 2026-11-10; reusable)

Paths in `<angle brackets>` must be read from the actual server; do not guess them.

1. **Confirm the host and running code.** On the game host, record the backend checkout path and commit (`git -C <checkout> log -1 --oneline`, `git -C <checkout> status --short`), `pm2 describe morkahja-api`, and the active Nginx site file (`sudo nginx -T`). The frontend on this branch speaks the API of current `main`, including server-issued session challenges. **If production runs an older backend, the frontend and backend must be upgraded together.** The backend creates any missing tables at startup (`CREATE TABLE IF NOT EXISTS`, including `session_auth_challenges`); it does not reset or reseed data, but it is still a production change requiring approval.
2. **Back up the database off the host and prove the restore.**
   ```sh
   # On the host (credentials from the server .env, not typed into shell history)
   pg_dump --format=custom --file=morkahja-$(date +%Y%m%d-%H%M).dump "$DATABASE_URL"
   # Copy it off the server (e.g. scp to the Nobara machine), then restore into a throwaway container:
   podman run -d --rm --name morkahja-restore-check -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:55433:5432 docker.io/library/postgres:16
   pg_restore --no-owner --dbname=postgres://postgres:postgres@127.0.0.1:55433/postgres --create morkahja-<stamp>.dump
   # Compare row counts of players, avatars, sessions, purchases with production before trusting it.
   ```
   Never restore into, reset or reseed the production database.
3. **Identify persistent content.** `server/game/*.json` in the backend checkout is writable through the admin API (`/game-data/admin`), so treat that directory as persistent. Check `git -C <checkout> status` before any `git pull`, and back it up. Record any other upload or artwork directories found on the host.
4. **Stage the frontend as a new release, without deleting anything.**
   ```sh
   RELEASE=<releases-dir>/$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)
   mkdir -p "$RELEASE" && rsync -a client/dist/ "$RELEASE/"   # no --delete, fresh directory
   ```
   Keep `<releases-dir>` and `<parent>` outside the website's document root and outside any persistent content directory.
5. **Nginx.** Back up the active site file (`sudo cp <site-file> <site-file>.bak-<stamp>`). Install the filled-in template, add the `include`, run `sudo nginx -t`, and reload (`sudo systemctl reload nginx`) only if the test passes. Before the reload, point `<parent>/Morkahja` at the release: `ln -sfn "$RELEASE" <parent>/Morkahja`.
6. **Backend environment.** Update `.env` with the values above, then `pm2 restart morkahja-api --update-env`.
7. **Stripe.** Update the webhook endpoint if Stripe is enabled.
8. **Verify** (see checklist), from an external network and a fresh browser profile.

### Rollback

- Frontend: `ln -sfn <previous-release> <parent>/Morkahja` (or remove the include for a first deployment).
- Nginx: restore `<site-file>.bak-<stamp>`, `sudo nginx -t`, reload.
- Backend: restore the previous `.env` (and commit, if it was upgraded), `pm2 restart morkahja-api --update-env`.
- Stripe: restore the previous webhook URL/secret.
- **The database is not rolled back.** Restoring the backup is a separate, explicit decision, because it would discard real player activity since the backup.

Keep the previous release, Nginx file and `.env` copy until the new route has been stable for a while.

## Next deployment: game content from the server (PR #18)

Recorded on 2026-11-10, when `main` first contained PR #18 while production still ran backend `95fd5c5a` and frontend `0d217fc7`. **Done on 2026-11-11**; see *Production release — 2026-11-11* below.

- **Backend and frontend together.** The current client loads all game content from `GET /game-data/content` and no longer carries a built-in copy. The deployed backend predates that endpoint (a live request to `/Morkahja/api/game-data/content` returned 401 on 2026-11-10). Do not use the frontend-only phase for a client built from current `main` until the backend is upgraded.
- **Preserve live content edits.** `server/game/*.json` in the server checkout is the persistent, admin-writable content (step 3 above). Compare it with `main` and back it up before switching the checkout; any live edits must be kept, not overwritten by the repository copy.
- **Check compression.** The content response is about 460 KB uncompressed. Confirm whether Nginx compresses `application/json` before or after the release.
- **Verify** with the checklist above, plus a browser play-through confirming that content loads during the loading screen.

## Routine releases with `morkahja-deploy` (since 2026-11-11)

Before this tool, every root step needed Babuni's `sudo` password, so releases stopped halfway and waited. At Babuni's request (D-009 in `DECISIONS.md`), the server now has one root-owned command, `morkahja-deploy`, which the deploy login may run through `sudo` without a password. The sudo rule names that one command and nothing else; every other root action still needs the password. The deploy login cannot edit the command. It lives outside the repository because it names server-internal paths and accounts, and its first run log is on the server.

| Phase | What it does |
| --- | --- |
| `status` | Read-only: backend branch and commit, uncommitted files, current frontend release, health and content endpoint, last backup. |
| `backup` | `pg_dump` with row counts and checksum, plus `.env` and `server/game`; copies the dump to the deploy login's staging folder so it can be taken off the host. Changes nothing else. |
| `release` | Backend and frontend together: checks the upload checksums, refuses a client archive with links or unsafe paths and a bundle with any branch but `main`, and stops if `server/game` has uncommitted live edits. Then backs up, fast-forwards the server's `main` from the bundle, runs `npm ci`, restarts PM2, and requires `/health`, the session challenge and `/game-data/content` to answer before switching the frontend symlink. Any backend failure rolls the backend back automatically. Ends with public HTTP checks. |
| `rollback` | Returns the backend to the previous commit, `node_modules` and `.env`, and the frontend to the previous release. The database is never touched. |
| `frontend` / `frontend-rollback` | Client-only release and its undo. Refused while the backend lacks `/game-data/content`, so a current client can no longer be paired with an older backend. |
| `bots-status` / `bots-start` / `bots-stop` | The bot adventurers (PM2 app `morkahja-bots`, D-012): state and recent log, start or restart, stop. Stopped bots stay stopped through later releases until `bots-start`. Added 2026-11-11. |

Releases and rollbacks run `pm2 startOrRestart ecosystem.config.cjs`, which also starts apps new to the file (the bots on their first release); a rollback removes `morkahja-bots` first, in case the previous commit does not define it. Since 2026-11-11 the backend update fetches the bundle into a side ref and fast-forwards `main`, because Git refuses to fetch straight into a checked-out branch.

**Uploading a release:** build the client (`npm run build --prefix client`), pack `client/dist` as `client.tar.gz`, create a Git bundle of `main` starting from the commit the server runs (`git bundle create morkahja.bundle <server-commit>..main`), write `SHA256SUMS` for both, and copy the three files to the staging folder. Then run `sudo morkahja-deploy release` over SSH, and restore the new dump into a disposable PostgreSQL container to prove the backup.

## Production release — 2026-11-13, 06:35 UTC (0.9.0-beta.50, essence slot fix)

Approved by Babuni ("yes release it"). `main` at `5022cde9` (PR #31): client fix so each essence slot keeps its own essence; server changes are the version strings only.

- **Before:** backend `ccc6cb20`, frontend `20261113-055920`, no uncommitted files. Previous staging files moved to `prev-20261113-0635`.
- **Checks before the release:** CI `verify` passed on PR #31; client tests 36/36 and `npm run typecheck` passed on the branch.
- **Release:** backup `20261113-063531` (2.9 MB; 71 players, 104 avatars, 104 inventories, 1 purchase, 327 achievement rows; sha256 `7a087d2a…`). Backend fast-forwarded to `5022cde9`, `npm ci`, health gate and content endpoint passed, frontend release `20261113-063533` (`index-4B1KP1zr.js`, contains `0.9.0-beta.50`), public checks passed. Bots back online.
- **Not done:** backup restore not proven (dump download not permitted in this session); the fix was not checked on screen by AI in production or locally.

## Production release — 2026-11-13, 05:59 UTC (0.9.0-beta.49)

Requested by Babuni ("i wanna deploy the latest changes to the live server"). The 22 commits on `fix/mobile-centering` (beta.43 → beta.49) had not been pushed or merged. AI merged `main` into them (keeping both sides of the documentation conflicts in `DECISIONS.md` and `DEVLOG.md`), ran the release gate, and squash-merged PR #29, so `main` is now `ccc6cb20`. The server changes only the version strings; no dependency, schema or game-content changes since `e78cde2f`.

- **Before:** backend `main` at `e78cde2f`, frontend `20261111-080433`, no uncommitted files on the server. Unreleased files staged on 12 November were moved to a dated folder in the staging directory, not deleted.
- **Release gate:** `npm run release:check` on the merged tree (Nobara, local Podman PostgreSQL) exited 0: game data verified, typecheck and client build, client tests 32/32, server tests 40/40. CI `verify` passed on PR #29.
- **Uploads:** client build of `ccc6cb20` (`index-CJPwKA8p.js`) and a Git bundle of `e78cde2f..main`; checksums verified on the server.
- **Release:** backup `20261113-055919` (2.9 MB, 17 tables with data; 71 players, 102 avatars, 21 sessions, 76 devices, 102 inventories, 1 purchase, 324 achievement rows; sha256 `9d2dde3b…`). Backend fast-forwarded to `ccc6cb20`, `npm ci`, health gate and content endpoint passed, frontend release `20261113-055920`, public checks passed.
- **Bots:** Varrokh, Sylvaen and Thalyss signed in again as the same player ids.
- **Live check from outside:** website, `/Morkahja/` and the API health endpoint answered 200; the page loads `index-CJPwKA8p.js`, which contains `0.9.0-beta.49`.
- **Not done:** the backup was not downloaded and restored this time (downloading the dump was blocked by the session's permission rules), so the restore of `20261113-055919` is **unproven**. No browser play-through, real mobile browser, multiplayer or Stripe checkout in production was checked by AI.

## Production release — 2026-11-11 (PR #18 live)

Requested by Babuni ("do the next deploy and update the server and client together"). AI assistance prepared and uploaded the release and ran every step; Babuni ran only the one-time `sudo` installation of `morkahja-deploy`. Times are the server's clock (UTC).

1. **Before:** `status` showed backend `95fd5c5a` on the subpath branch, no uncommitted files, frontend release `20261110-103704`, and `/game-data/content` answering 401. The server's `server/game` matched its commit, so there were no live content edits to preserve.
2. **Uploads:** client build of `main` at `5e5481f7` (main bundle about 512 KB instead of about 948 KB) and a 48 KB Git bundle of the 16 commits after `95fd5c5a`; checksums verified on the server. The previous staging files were kept in a dated folder.
3. **`release` at 23:37 UTC on 10 November** (00:37 on 11 November in Babuni's time zone): backup `20261110-233714` (1.6 MB, 15 tables with data; 63 players, 91 avatars, 14 sessions, 70 devices, 91 inventories, 273 achievement rows). The server's `main` fast-forwarded from the June commit `77062a42` to `5e5481f7` and is now the checked-out branch; `npm ci` installed 259 packages; the health gate passed with the content endpoint answering 200. Frontend release `20261110-233715` was switched in. No dependency or `.env` changes, no Nginx changes, and the database was not reset, reseeded or restored.
4. **Backup proof:** the dump was downloaded, its SHA-256 matched, and it was restored into a disposable PostgreSQL 18 container with every row count matching. The only restore messages concerned admin roles that exist only on the server.

### Live verification — 2026-11-11 (from outside the server)

- `/`, `/Morkahja` (301 to `/Morkahja/`), `/Morkahja/`, `/Morkahja/api/health` and a menu image all answered as before.
- `/Morkahja/api/game-data/content` returned 203 encounters, 247 solutions, 4 expansions, 100 frames and 682 portraits, matching `server/game` on `main`. Nginx serves it gzip-compressed (about 104 KB instead of about 460 KB), and a repeat request with its ETag returned `304`.
- A fresh headless Chrome profile loaded the new bundle and reached the welcome screen (Start New Journey / Restore Existing Journey). Its only console messages were the expected `SESSION_INVALID` lookups of a browser with no account.
- **Not verified by AI:** a played turn on a real account, two-person multiplayer, a Stripe checkout, mobile browsers.

## Production release — 2026-11-11, 08:04 UTC (level-up fix and lore gem)

Approved by Babuni ("yes"). `main` at `e78cde2f` (PR #26); code only, no dependency or game-content changes since `a40a6c5c`.

- **Release:** backup `20261111-080431` (sha256 `f32ed36a…`); backend fast-forwarded to `e78cde2f`; `npm ci`; health gate with content endpoint passed; frontend release `20261111-080433`; public checks passed.
- **Bots:** restarted with the release; after start-up retries while the API came up, Varrokh, Sylvaen and Thalyss signed in again as the same accounts (same player ids), with no new sign-ups.
- **Backup proof:** dump downloaded, SHA-256 matched, restored into a disposable PostgreSQL 18 container with every row count matching.
- **Not verified by AI:** a real player's level-up in production after the fix.

## Production release — 2026-11-11 (standalone game screen and bot adventurers)

Requested by Babuni ("I want to merge and release this"). `main` at `a40a6c5c` (PR #24) for backend and frontend; no dependency or game-content changes since `5e5481f7`. Times are the server's clock (UTC).

1. **Deploy tool update:** Babuni installed the new `morkahja-deploy` (bot commands, `startOrRestart`) with `sudo`; installed checksum `6c569a93…`.
2. **First attempt, 07:17:** backup `20261111-071755`, then the backend step failed with `refusing to fetch into branch 'refs/heads/main' checked out`, because the server was now on `main` (the first release had started from another branch). The automatic rollback kept backend `5e5481f7` and restarted the API, so the game was unreachable for a few seconds; frontend and database were untouched, and the live site answered normally right after.
3. **Fix:** fetch into `refs/remotes/release/main`, then `git merge --ff-only`. Tested on a clone set up like the server, with `main` and with another branch checked out; the old command reproduced the failure. Babuni reinstalled the tool (checksum `eb18ed9d…`).
4. **Release, 07:19:** backup `20261111-071930` (1.6 MB, 17 tables with data; 64 players, 92 avatars, 14 sessions, 70 devices, 92 inventories, 1 purchase, 277 achievement rows); backend fast-forwarded to `a40a6c5c`; `npm ci`; health gate passed with the content endpoint; frontend release `20261111-071931` switched in; public checks passed. PM2 then showed `morkahja-api` and `morkahja-bots` online.
5. **Bots:** the first bot start met the API still starting (`ECONNREFUSED`) and crashed before signing up; PM2 restarted it and Varrokh, Sylvaen and Thalyss signed up as new players with avatars Brakru, Vaedae and Myrsyl. Stable one minute later (no further restarts).
6. **Backup proof:** dump downloaded, SHA-256 matched, restored into a disposable PostgreSQL 18 container with every row count matching.

**Not verified by AI:** a played turn by a real player on the new screen in production, phones, a real player's Call for help reaching Sylvaen or Thalyss in production.

## Production deployment — 2026-11-10

Approved by Babuni ("deploy it to the server"). AI assistance prepared, uploaded and checked every artifact; Babuni ran the two `sudo` phases of a staged script kept on the server, outside the repository, because it names server-internal paths and accounts.

1. **Backup** (`backup` phase): a custom-format `pg_dump` (1.6 MB, 14 tables with data; 62 players, 90 avatars, 13 sessions, 65 devices, 90 inventories, 267 achievement rows), plus copies of the backend `.env`, both Nginx site files and `server/game/*.json`, stored on the server. A copy of the dump was downloaded to the development machine, its SHA-256 verified, and **restored into a disposable PostgreSQL 18 container with every row count matching**.
2. **Rehearsal:** the deployed backend commit was started against that restored copy. It came up healthy and served the new authentication API. Its only schema change was the new `session_auth_challenges` table; no tables were removed and row counts were unchanged.
3. **Deploy** (`deploy` phase):
   - **Backend:** switched to commit `95fd5c5a` from a verified git bundle. The modified `package-lock.json` was stashed and the previous `node_modules` kept for rollback. Ran `npm ci`, set `CLIENT_ORIGINS=https://www.babuni.dev` and `CLIENT_URL=https://www.babuni.dev/Morkahja`, then restarted PM2 and saved its state. A health gate checked `/health` and the challenge endpoint, with automatic backend rollback on failure; it passed.
   - **Frontend:** unpacked into a new timestamped release directory outside the website root and switched in by symlink.
   - **Nginx:** installed the filled-in location template as a snippet, added one `include` line before the website's catch-all location, passed `nginx -t`, and reloaded.
4. The database was not reset, reseeded or restored.

**Rollback:** the same script's `rollback` phase restores the previous Nginx site file, removes the snippet, removes or reverts the frontend symlink, and returns the backend to its previous commit, `node_modules` and `.env`. The database is left untouched. Releases and backups are kept.

### Live verification — 2026-11-10 (from outside the server)

HTTP checks against `https://www.babuni.dev`:
- `/` returned the website (200).
- `/Morkahja` and `/Morkahja?x=1` returned 301 to the trailing-slash URL, keeping the query string. `/Morkahja/` and a deep link returned the game shell.
- `/Morkahja/api/health` and `/Morkahja/api/game-data/status` returned JSON (203 encounters, 247 solutions, 100 frames, 682 portraits). Unknown API routes returned a JSON 401, never HTML.
- The manifest was `application/manifest+json`. Icon, preview image, font and music all returned 200.
- A missing game asset returned a real 404. `/health` and `/UI/…` at the site root returned 404.
- `POST /Morkahja/api/stripe/webhook` reached Express and rejected the unsigned probe (`400 INVALID_SIGNATURE`).
- The website's `X-Content-Type-Options` and `Referrer-Policy` headers were present on game assets. `og:url` and `og:image` point beneath `/Morkahja/`.

Headless Google Chrome (fresh temporary profiles) at `https://www.babuni.dev/Morkahja/`:
- **New journey** (test player `LiveCheck`, avatar `Livewire`): registration, recovery-key download, avatar creation, the encounter screen and the Lore/Inventory overlays all worked with no broken images, console errors or requests outside `/Morkahja/`.
- Deep-link refresh kept the session. Logout cleared it.
- **Restore** in an empty profile: same `playerId`, identical player record (ignoring session/timestamp fields), avatars, inventory and achievements.
- **Gameplay:** one encounter turn was committed through the live API (`waiting_continue` → `active_encounter`, experience 0 → 2).

The `LiveCheck` test player remains in the production database.

### Gameplay hotfix — 2026-11-10

After the cutover, Babuni reported that a turn stopped after choosing a solution. Cause: since #17 the server withholds encounter rolls until a choice is committed, but the client committed only once it knew the roll, so it synced the selection and never committed. The June backend had sent rolls in advance, which hid the bug. The earlier AI-run browser tests had shown the same stall, but it was wrongly attributed to headless clicking and the turns were committed through the API instead, so the verification above did not exercise the real reveal path.

Fix `0d217fc7` commits on the reveal phase and lets the server's resolution supply the roll. It was deployed as a **frontend-only release** through the script's new `frontend` phase (Babuni ran it with `sudo`); the previous release is kept for `frontend-rollback`. Live verification with **real UI clicks** on the `LiveCheck` player: a solution turn and a dice turn each committed, showed the roll, unlocked Continue and advanced (XP 2 → 4, then a level-up to 2), and the resulting level-up **system event** committed and returned to a normal encounter. No exceptions, and no requests outside `/Morkahja/`. Two-person multiplayer remains untested.

**Babuni-reported (2026-11-10):** restoring their own **pre-migration** account with its recovery key at `https://www.babuni.dev/Morkahja/` worked. This is a manual check; no individual field comparison was supplied. **Stripe:** the dashboard endpoint was changed to `https://www.babuni.dev/Morkahja/api/stripe/webhook` with `checkout.session.completed` and `checkout.session.async_payment_succeeded`, keeping the existing signing secret.

**Still not verified live:** a real Stripe checkout return and signed webhook delivery at the new URL (no purchase has occurred yet); PWA installation; two-person multiplayer; real mobile browsers; Nginx/PM2 log review (the deploy account cannot read them).

## Player identity and recovery

The origin changes from the former domain to `https://www.babuni.dev`. Browser storage is per origin, so the old session, device key and **identity key** in the former domain's `localStorage` do not carry over. The former domain is no longer under the project's control, so no redirect or storage hand-off is possible.

Existing players can return only by using **Restore Existing Journey** with their downloaded Morkahja recovery-key file (`Morkahja_<name>.key`). The server matches the key's identity public key to the existing player record and issues a new device/session. This requires the **same production database**.

- Do not promise recovery to players without a key file. There is no other recovery mechanism in the code. Handle such cases individually, and never silently create a replacement player.
- An installed PWA from the former domain will not move. Players need to install again from `https://www.babuni.dev/Morkahja/`.
- Locally verified (below): restoring in an empty browser profile returned the same `playerId` and identical player, avatar, inventory and achievement data. **Not yet verified:** restoration of a real pre-migration production account at the live URL.

## Same-origin security assessment

Serving the game at `https://www.babuni.dev/Morkahja/` puts it in the **same browser origin** as every other page on `www.babuni.dev`. URL paths are not a browser security boundary. The URL is kept as requested; these risks are documented, not designed away:

- **`localStorage` is origin-wide.** Any script running on any `www.babuni.dev` page can read `morkahja.identityKeypair` (the player's identity **private key**), `morkahja.deviceKeypair` and `morkahja.session` (the bearer token). XSS or a compromised third-party script anywhere on the website therefore means full Morkahja account takeover. Website pages should load no third-party or untrusted scripts. An origin-wide Content-Security-Policy is strongly recommended; none is set today.
- **Service workers.** Morkahja registers none. A website service worker registered with scope `/` would intercept `/Morkahja/` and `/Morkahja/api/` requests; avoid it, or scope it away from `/Morkahja/`.
- **Cookies.** Morkahja authenticates with `Authorization: Bearer`, not cookies. Website cookies on `www.babuni.dev` (and any set for the parent `babuni.dev` domain) will still be sent with `/Morkahja/api/` requests; they are not used by the API.
- **Framing and transport.** No `X-Frame-Options`/`frame-ancestors` or HSTS is set on the website today. Consider adding them to the whole server block, keeping the header-inheritance warning above in mind.
- **Admin API exposure.** `/Morkahja/api/game-data/admin/*` is reachable publicly through the proxy and protected only by the existing admin authentication. Consider an Nginx `allow`/`deny` restriction for it.
- **Stronger isolation** would require a separate origin such as a subdomain. That is an architecture change and was not made.

## Verification

### Local automated checks — 2026-11-10, Nobara, branch `feat/babuni-dev-subpath`

Run against a disposable `postgres:16` Podman container on `127.0.0.1:55432`. The developer's `morkahja-db` container was not touched.

- `NODE_OPTIONS=--throw-deprecation npm run release:check` — **passed (exit 0)**: static-data sync, shared/server typecheck, client `tsc -b && vite build`, 6 client test files and 37 server tests (all 33 previous files plus 4 new trust-proxy tests). No deprecation warnings.
- `npm run test:encounter` / `npm run test:lifecycle` **no longer exist**. PR #17 replaced them with the single `npm test`, which includes `encounterResolver`, `roomService`, `soloRoomCheckpointService` and the other encounter/room suites above.
- After merging `main` (#8) into the branch, one full-suite run failed `systemEventInventory.test.ts:255` (expected 6 essence uses, got 10). The test passed three times in isolation on the branch and twice on `main`, and two further full-suite runs on the branch passed 37/37. It is recorded as an intermittent gameplay test unrelated to the path changes; its cause was not investigated.
- ESLint on the client reports 110 problems, all identical on `main` (no new findings from this branch).
- Build inspection: `dist/index.html`, CSS and manifest reference only `/Morkahja/…` or relative URLs. The only raw `/UI/` literal in the JS bundle is the shared dice root, which is wrapped at every client call site.

### Local integration environment — 2026-11-10

Nginx `1.27-alpine` (Podman, host network) with a stand-in website at `/`, the production build at `/Morkahja/` via the template above, and `/Morkahja/api/` proxied to the branch backend on `127.0.0.1:3000` (test database). `nginx -t` passed. Results:

- `/` and an existing website file → 200 from the stand-in site. `/health` and `/UI/…` at the root → 404: the game is not exposed at the root.
- `/Morkahja` and `/Morkahja?x=1` → 301 to `/Morkahja/` (query preserved). `/Morkahja/` and `/Morkahja/some/deep/link` → game shell.
- `/Morkahja/api/health` → `200 application/json {"status":"ok",…}`. Unknown API paths → Express JSON 401, not HTML. `POST /Morkahja/api/stripe/webhook` reaches Express (`503 WEBHOOK_NOT_CONFIGURED`, expected without a local secret).
- Missing `/Morkahja/UI/…` and `/Morkahja/assets/…` → real 404. Music is served with byte ranges (206). The manifest is `application/manifest+json`.
- Per-client rate limiting through Nginx: 26 rapid challenge requests from one forwarded address → the 26th got 429; a second address was unaffected.

Headless Google Chrome (DevTools protocol, temporary profiles) at `http://127.0.0.1:8088/Morkahja/`:

- **New journey:** challenge + bootstrap through `/Morkahja/api/`, recovery key downloaded, dashboard, avatar creation and the encounter screen rendered. Screenshots show encounter art, portraits, frames, dice, solution icons, UI chrome and the custom font. No broken `<img>` elements on any screen checked, including Lore/Inventory/Skillbook overlays. **No request escaped `/Morkahja/`.** No console errors beyond the expected pre-login `SESSION_INVALID` probes.
- **Deep link refresh** inside the app kept the session.
- **Logout** (Settings → End Session) cleared the session and returned to the gateway.
- **Recovery-key restore** in a fresh, empty profile: same `playerId`, identical player record (ignoring session/timestamp fields), avatars, inventories and achievements, new session ID.
- **Gameplay after restore:** room create, selection, polling, then `POST /room/choice` and `/room/continue` through the proxy. The room advanced (`waiting_continue` → `active_encounter`) and avatar experience went 0 → 2 in the database. The choice/continue calls were issued from page JavaScript because synthetic clicks did not commit the turn. That was not a test artifact but the real stall fixed in `0d217fc7`; see *Gameplay hotfix*.

### Not verified locally

- Production items: covered later in *Live verification*, which also lists what remains unverified.
- Restoration of a real pre-migration account at the live URL.
- Multiplayer with two real players; PWA install prompt and standalone launch; music playback audibility; real mobile browsers.

## Follow-ups after cutover

1. **Stripe:** endpoint updated (done). Confirm the first real checkout return and a successful delivery in the destination's event log.
2. **Repository:** merge `feat/babuni-dev-subpath` into `main`, then return the server checkout to `main` (it currently runs a local branch fetched from a bundle) and drop the stashed `package-lock.json` change once it is confirmed obsolete. *Merged as #19 and the server returned to `main` on 2026-11-11. Still open: the old stash and the `node_modules` backup folders on the server, kept for rollback.*
3. **Optional:** delete the `LiveCheck` test player; review the same-origin security recommendations; retire the former domain's Nginx site.

## Verification checklist (reuse for later releases)

```sh
curl -sI https://www.babuni.dev/ | head -1                     # website, 200
curl -sI https://www.babuni.dev/Morkahja | grep -i ^location   # -> /Morkahja/
curl -s  https://www.babuni.dev/Morkahja/api/health            # {"status":"ok",...}
curl -s  https://www.babuni.dev/Morkahja/api/no-such-route     # JSON error, not HTML
curl -sI https://www.babuni.dev/Morkahja/UI/01_1_SignIn/menuBG.webp | head -1   # 200 image/webp
curl -sI https://www.babuni.dev/Morkahja/manifest.webmanifest | grep -i content-type
```

Also confirm `http://www.babuni.dev/Morkahja/` redirects to HTTPS (Web Crypto, which recovery keys need, only works in a secure context). Then, in a fresh browser profile: new journey, avatar creation, one encounter, refresh on a deep link, logout, restore with a **pre-migration** recovery key and compare avatars/inventory/achievements/entitlements with the backup. Check PWA install and launch scope, Stripe test checkout and webhook (if enabled), the browser console, and Nginx/PM2 logs.
