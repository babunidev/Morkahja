# Deployment plan — Morkahja under babuni.dev

**Status:** Repository implementation done and verified locally in an Nginx integration environment. **Not deployed.** Production cutover still needs server access, a verified database backup, and Babuni's explicit approval. The hostname question is settled: the game goes on `www.babuni.dev`.  
**Recorded:** 2026-11-09 (plan) · updated 2026-11-10 (implementation, discovery and local verification)  
**Branch:** `feat/babuni-dev-subpath`  
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
| Former game VPS, PostgreSQL, PM2 | **Not established.** The historical root `DEVLOG.md` describes a Hetzner VPS with Nginx serving `/var/www/morkahja`, PM2 `morkahja-api` on `127.0.0.1:3000`, and PostgreSQL on localhost. No server access details were available for this work, so it is unknown whether the game still runs on that VPS or shares a host with the website. |
| Stripe | **Not established.** The repository has live price IDs and a `/stripe/webhook` endpoint. Whether production has `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` set, and which webhook URL Stripe uses, needs the server `.env` and the Stripe dashboard. |

### Decision: serve the game from `www.babuni.dev`

`https://babuni.dev/` does not serve the website today. The apex goes to the registrar's parking service and has no certificate. Given the two options (point the apex at the website host, or use the existing `www` host), **Babuni chose `https://www.babuni.dev/Morkahja/` on 2026-11-10** (see D-006 in `DECISIONS.md`). No DNS change is required for this, and none was made.

What the decision implies:

- The browser origin is `https://www.babuni.dev`. That is a **different origin** from the apex `https://babuni.dev`. If the apex is later connected to the website, redirect it to `www` (for example a 301 of `https://babuni.dev/*` to `https://www.babuni.dev/*`) rather than serving the game on both names. Otherwise players would end up with separate browser storage, and so separate local identities, per name.
- Until then, `babuni.dev/Morkahja/` shows the parking page. Links and announcements should use the full `https://www.babuni.dev/Morkahja/` address.

The rest of this document uses `www.babuni.dev`.

## What the repository now does

Implemented on `feat/babuni-dev-subpath` (see `CHANGELOG.md` for the file list):

- **Vite base:** Production builds and `vite preview` use `base: '/Morkahja/'`. Development (`npm run dev:client`) still serves from `/` with the unchanged root API proxies. `VITE_BASE_PATH` overrides the base when needed.
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

## Deployment procedure (requires approval; not executed)

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
- **Gameplay after restore:** room create, selection, polling, then `POST /room/choice` and `/room/continue` through the proxy. The room advanced (`waiting_continue` → `active_encounter`) and avatar experience went 0 → 2 in the database. The choice/continue calls were issued from page JavaScript; driving that final dice-reveal animation by synthetic clicks in headless Chrome did not succeed, so the in-browser reveal UI was not exercised.

### Not verified

- Anything in production or staging: DNS, TLS for the apex, the live website, live Nginx, PM2, the production database, backups/restore, Stripe checkout and webhooks.
- Restoration of a real pre-migration account at the live URL.
- Multiplayer with two real players; PWA install prompt and standalone launch; music playback audibility; real mobile browsers.

## Remaining blockers before cutover

1. **Access:** SSH user/host for the website host and the game host (if different), and confirmation of where the production API and PostgreSQL run.
2. **Data safety:** an off-host database backup with a tested restore, and a record of persistent content directories.
3. **Approval:** Babuni's explicit approval for the production cutover after reviewing this branch.
4. **After cutover:** the live verification checklist from a fresh browser, recorded here with dates and results.

## Verification checklist for the live cutover

```sh
curl -sI https://www.babuni.dev/ | head -1                     # website, 200
curl -sI https://www.babuni.dev/Morkahja | grep -i ^location   # -> /Morkahja/
curl -s  https://www.babuni.dev/Morkahja/api/health            # {"status":"ok",...}
curl -s  https://www.babuni.dev/Morkahja/api/no-such-route     # JSON error, not HTML
curl -sI https://www.babuni.dev/Morkahja/UI/01_1_SignIn/menuBG.webp | head -1   # 200 image/webp
curl -sI https://www.babuni.dev/Morkahja/manifest.webmanifest | grep -i content-type
```

Also confirm `http://www.babuni.dev/Morkahja/` redirects to HTTPS (Web Crypto, which recovery keys need, only works in a secure context). Then, in a fresh browser profile: new journey, avatar creation, one encounter, refresh on a deep link, logout, restore with a **pre-migration** recovery key and compare avatars/inventory/achievements/entitlements with the backup. Check PWA install and launch scope, Stripe test checkout and webhook (if enabled), the browser console, and Nginx/PM2 logs.
