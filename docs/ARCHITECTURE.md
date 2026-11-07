# Morkahja — architecture snapshot

**Author:** Babuni.dev

- `client/`: React/Vite browser interface including dashboard, world, encounter and account screens.
- `server/`: Express/TypeScript services for sessions, encounters, progression, social data and other game operations.
- `shared/`: shared TypeScript contracts.
- `package.json`: workspace commands for typechecking, encounter/lifecycle tests and release checks.
- `DEVLOG.md`: evolving development notes and commit references.

Static inspection only; no server tests, browser tests or production configuration checks executed here.

## Architectural development evidenced by the original journal

The journal identifies three coordinated pieces by the **May 18, 2026 playable checkpoint**: React/Vite browser client, Express API services, and shared client/server TypeScript contracts. It describes PostgreSQL-backed persistent game documents and later server-authoritative enforcement of encounter outcomes and avatar death (May 22). A shared dice interpretation layer was added to reduce client/server disagreements.

The current root package declares **`0.9.0-beta.2.2`** with npm workspaces `client`, `server` and `shared`. Named verification entrypoints are `verify:static-data`, `test:encounter`, `test:lifecycle`, `typecheck` and `release:check`; their presence establishes a test path, **not a passing test result**. The server package additionally exposes specific tests for sessions, rooms, achievements, dice, commerce and inventory.

In the historical May 23 entries, the project gained PM2/nginx deployment configuration, a same-origin API default and documented HTTPS requirements for Web Crypto-based onboarding. The journal notes a Hetzner public alpha. That historic deployment evidence does **not** verify current availability, credentials, backup policy or security. The pre-invite review itself records additional safeguards as needed before wider launch.

**Boundary:** This is a static examination of repository metadata and historical journal, not a penetration test, live-environment audit, database migration or deployment verification.

## Phase 2 — opt-in revisioned content storage (implementation branch, 2026-11-07)

The server now has a proposed, review-stage implementation of durable JSON content revisions in `server/src/services/contentPublication.ts`. Explicit `MORKAHJA_CONTENT_ROOT` activation makes `gameData.ts` read external published content, with direct file writes disabled in that mode. The client remains build-time JSON-backed and production cutover is not authorized. See [content storage](CONTENT_STORAGE.md). Source/CI verification status is tracked in the review PR.

## Phase 3 — published runtime snapshot and public content API (review branch, 2026-11-07)

The backend can now capture all five published JSON datasets as one versioned runtime snapshot. A reader retains that exact revision across a pointer swap, and a fresh read detects newer content. New solo encounter creation uses one captured encounter/solution set for selection and regular reward generation; active snapshot/room revision pinning remains unimplemented. A public read-only `GET /game-data/content` serves a coherent bundle with ETag revalidation, and returns a generic 503 instead of a Git fallback when published mode is unavailable. The old client still uses build-time JSON. Details and remaining safeguards: [Runtime integration](CONTENT_RUNTIME.md).

## Phase 4 — secure content administration (draft PR #12, 2026-11-07)

Authenticated administrator content reads, per-category record editing through stateless revision-based changes, full-bundle validation, explicit publication/rollback and durable private audit entries are implemented in an isolated review branch. The former per-record direct-write routes now return HTTP 410; publishing is separately disabled by default. The current bearer-key authentication is hardened with constant-time comparison, and admin requests have dedicated body/rate limits. Image references may only reuse existing published identifiers until managed WebP publication is built. No production keys, proxy policy, live data or deployments were changed. See [secure admin content API](CONTENT_ADMIN_API.md).
