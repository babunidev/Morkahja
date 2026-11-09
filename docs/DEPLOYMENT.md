# Deployment plan — Morkahja under babuni.dev

**Status:** Proposed; approved target URL, implementation and production topology not yet verified  
**Recorded:** 2026-11-09  
**Target game URL:** https://babuni.dev/Morkahja/

## Goal

Move the public game address from the former game domain to `https://babuni.dev/Morkahja/`, while keeping the main website at `https://babuni.dev/`.

Morkahja should remain an independently deployable frontend and API beneath the website. The existing player database and game backend should be retained. This plan does not authorize a database reset, player-data migration, or destructive deployment.

## What is known from the repository

The following points were confirmed by static source inspection on 2026-11-09:

- The frontend is a React application built with Vite. `client/vite.config.ts` currently has no Vite `base` setting.
- `client/src/api/http.ts` already reads `VITE_API_BASE_URL` and prefixes its API requests with that value. The default is the same-origin root.
- The Express API listens on port 3000 by default and registers routes at the root, including `/session`, `/player`, `/avatar`, `/avatars`, `/encounter`, `/room`, `/activity`, `/game-data`, `/health`, and `/stripe/webhook`.
- The frontend contains root-relative asset paths such as `/UI/...` and `/game/...`. Vite's `base` setting alone does not rewrite arbitrary root-relative strings assembled at runtime.
- `client/index.html` references the favicon, Apple touch icon and web manifest at root paths.
- `client/public/manifest.webmanifest` currently declares `/` as both `start_url` and `scope`, and its icon path is root-relative.
- `client/socialPreview.ts` still has the former game domain as its production fallback. The Vite social-preview plugin uses `VITE_SITE_URL` when supplied.
- `server/src/config/corsOrigins.ts` expects browser origins, not URL paths. `server/src/config/stripeConfig.ts` uses `CLIENT_URL` for checkout return URLs.
- The client stores its session, device keypair and identity keypair in browser `localStorage`. The onboarding flow downloads and restores a separate identity recovery-key file. The server resolves a restored player from the identity public key and verifies a signed challenge.

Historical entries in the original `DEVLOG.md` describe a Hetzner VPS, Nginx, PM2, PostgreSQL and an API on `127.0.0.1:3000`. Those entries are historical deployment evidence only; they do not establish the current server, DNS records, Nginx configuration, database state or hosting arrangement.

## Hosting and routing decision

DNS resolves a hostname to infrastructure; it cannot route a URL path such as `/Morkahja`. The server or reverse proxy receiving requests for `babuni.dev` must therefore route that path.

Two hosting arrangements are possible:

1. **Same host:** If the website and Morkahja can run behind the same Nginx instance, keep the existing website at `/` and add a dedicated `/Morkahja/` location for the game.
2. **Separate hosts:** If Morkahja remains on a different VPS, the host serving `babuni.dev` must reverse-proxy `/Morkahja/` and its API path to the game host. Protect the upstream connection and restrict direct backend access as appropriate.

Do not change DNS until the current website host, the game host and the intended proxy path are known. No hosting arrangement is selected by this plan.

## Implementation phases

### 1. Confirm infrastructure and protect data

- [ ] Identify the registrar/DNS provider and inspect the current A, AAAA and relevant CNAME records for `babuni.dev`.
- [ ] Identify where the main website is hosted and how its current HTTPS certificate is managed.
- [ ] Confirm whether the historical Morkahja VPS still exists, whether it is reachable, and whether its Nginx, PM2, Node and PostgreSQL services are still in use.
- [ ] Inspect the active Nginx virtual host and all existing website paths before adding a new location.
- [ ] Confirm the production database connection and take a versioned backup independent of the application host.
- [ ] Verify that the database backup can be restored before changing routing or deploying.
- [ ] Keep credentials, server IPs that should remain private, database dumps and private configuration out of Git.

**Safety constraint:** Keep the existing PostgreSQL database and player records. Do not run a reset, reseed, destructive migration, or deployment command that can delete website content or published game content.

### 2. Make the frontend work below a path

- [ ] Set Vite's production base to `/Morkahja/` in `client/vite.config.ts`.
- [ ] Build with `VITE_API_BASE_URL=/Morkahja/api`. The existing API client concatenates this prefix with its root API paths.
- [ ] Audit all root-relative runtime asset paths, including `/UI/`, `/game/`, fonts, audio, icons and assets returned in API payloads.
- [ ] Prefer a consistent base-aware asset URL helper using Vite's configured base for client-generated asset URLs. Normalize server-provided asset paths at the client boundary where needed.
- [ ] Only use Nginx aliases for root-level asset prefixes if a complete audit confirms that they do not collide with paths already used by the main website. Do not expose the game's entire asset tree at the website root by assumption.
- [ ] Ensure the generated HTML references the favicon, Apple touch icon and manifest beneath `/Morkahja/`.
- [ ] Change the PWA manifest's `start_url` and `scope` to `/Morkahja/`, and make its icon URL resolve beneath that scope.
- [ ] Set `VITE_SITE_URL=https://babuni.dev/Morkahja` for production builds and replace the obsolete fallback in `client/socialPreview.ts`.
- [ ] Inspect generated HTML, CSS and JavaScript for URLs that still escape to the domain root unexpectedly.

### 3. Route the API through the same public path

The intended public API prefix is `/Morkahja/api/`. Nginx should proxy this prefix to the existing Express listener while stripping the public prefix, so the backend continues to receive its current root routes.

For example, an Nginx location matching `/Morkahja/api/` can use a trailing-slash `proxy_pass` to `http://127.0.0.1:3000/`; this replaces the matched prefix with `/`. Confirm the exact behavior against the active Nginx configuration before deployment.

- [ ] Proxy all required API routes, including session, player, avatar, encounter, room, activity, game-data and health endpoints.
- [ ] Preserve request methods, query strings, authorization headers, response headers and request bodies.
- [ ] Route the Stripe webhook through the API proxy if Stripe purchases are enabled, and update the configured webhook URL in Stripe.
- [ ] Set server `CLIENT_ORIGINS=https://babuni.dev`. This is an origin and must not include `/Morkahja`.
- [ ] Set server `CLIENT_URL=https://babuni.dev/Morkahja` so Stripe success and cancellation returns go back to the game path.
- [ ] Keep the backend bound to a private interface such as `127.0.0.1:3000` when the proxy is on the same host; do not expose the Node port publicly without a specific need.
- [ ] Verify that the main website's existing API routes, if any, are unaffected.

### 4. Deploy the frontend without touching the website

- [ ] Build the frontend with the subpath configuration.
- [ ] Deploy the build into a dedicated Morkahja document root, separate from the main website's document root.
- [ ] Configure the `/Morkahja/` route to serve the built files and fall back to the Morkahja `index.html` for client-side routes.
- [ ] Keep the existing PM2 API process and database configuration unless inspection proves a change is required.
- [ ] Review every copy/synchronization command. Never run `rsync --delete` against the parent website directory or a directory containing persistent/published content.
- [ ] Validate Nginx configuration with `nginx -t` before reloading it.
- [ ] Keep a copy of the previous frontend release and Nginx configuration for rollback.

### 5. Preserve player identity and recovery

A change from the former domain to `babuni.dev` changes the browser origin. Browser storage is isolated by origin, so the old domain's `localStorage` session and private key material will not automatically appear at the new address.

The existing onboarding implementation supports restoring a player with the downloaded Morkahja recovery-key file. The restored identity public key is matched to the existing player record, and a new device/session is created. This depends on retaining the same production database.

- [ ] Test restoration at the new URL using a real test account and its recovery-key file before announcing the move.
- [ ] Verify that the restored player has the same player record, avatars, progression, inventory, achievements and entitlements.
- [ ] Tell existing players that their old browser session will not transfer automatically and that they need their recovery key to restore access.
- [ ] Do not claim that every player can recover unless recovery-key availability has been established. Assess any recovery case without a key separately; do not silently create a replacement player.
- [ ] Expect users with an installed PWA to install the game again under the new origin/scope.

### 6. Verify before cutover

- [ ] Confirm `https://babuni.dev/` still serves the main website.
- [ ] Confirm `https://babuni.dev/Morkahja/` serves the game and redirects the path without a trailing slash to the canonical trailing-slash URL.
- [ ] Refresh and directly open nested client routes; verify that they return the game shell rather than a 404.
- [ ] Check all JavaScript, CSS, fonts, images, portraits, frames, encounter/solution images, music and sound assets for successful loading.
- [ ] Confirm `/Morkahja/api/health` reaches Express and returns JSON, not the main website's HTML.
- [ ] Test new journey creation, recovery-key restoration, session heartbeat, logout and authenticated API requests.
- [ ] Test representative gameplay, room/party requests, game-data reads and player progression against the preserved database.
- [ ] Test PWA installation, launch URL and scope.
- [ ] If Stripe is enabled, test checkout success/cancel returns and webhook delivery.
- [ ] Review browser console, Nginx logs and PM2 logs for path, proxy, authorization and asset errors.
- [ ] Run the relevant repository checks after implementation. Record exact commands and observed results; do not mark this plan verified based on source inspection alone.

### 7. Cutover and rollback

- [ ] Schedule the change only after backup restoration and recovery-key tests pass.
- [ ] Deploy the frontend and Nginx configuration, validate the configuration, then reload Nginx.
- [ ] Verify the main website and game from an external browser/network.
- [ ] Keep the previous frontend artifact and Nginx configuration until the new route is stable.
- [ ] Roll back by restoring the previous route/configuration and frontend artifact. Keep the database unchanged during rollback.
- [ ] Do not depend on redirecting from the former domain; it is no longer under the project's control.

## Open questions before implementation

- Where does `babuni.dev` currently resolve, and which server/provider serves the main website?
- Is the former Morkahja VPS still available, and does it still contain the production API and database?
- Can the website host proxy to the game host, or should both applications be served from one host?
- Which Nginx configuration is active, and do any of the game's root-level asset paths conflict with the main website?
- Are Stripe checkout and webhooks active in the current production environment?
- Is there a current, independently restorable PostgreSQL backup?

## Verification status

This document records a proposed migration plan based on static inspection of repository files and the historical deployment journal. No DNS, hosting account, live server, Nginx configuration, production database, Stripe dashboard, build or browser session was accessed or changed while preparing it. No migration step or test is claimed as completed.
