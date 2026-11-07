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

## Phase 5 — managed artwork (draft PR #13, 2026-11-07)

A private, content-addressed WebP storage service under the external content root stages image bytes and validates their structure, dimensions, names, size and hash. Revision manifests now optionally link images by logical name to immutable SHA-256 objects, with the content-pointer swap as the single publication step. A public versioned media route returns managed images with immutable caching, while original media names and static file paths stay untouched until the separate client migration. The authenticated staging endpoint is disabled unless content publishing is explicitly enabled. Full image decoding, historical legacy-file parity and live operational review remain unverified. See [managed artwork](CONTENT_ARTWORK.md).

## Phase 6 — dynamic frontend content (draft PR #14, 2026-11-07)

The React client now selects one full content snapshot from the public revision-aware server endpoint through client/src/content/clientContent.ts. A useSyncExternalStore subscription publishes all five datasets and managed artwork URL mappings together only after validation. 304 preserves the prior snapshot and failures retain last-good data. Legacy Git fixture imports remain centralized in this module only for explicitly unconfigured published mode, not as fallback from corruption. GameEnvironment, ExpansionsOverlay, result/solution/inventory UI, party badges, animations, AvatarCreation and avatar image/preload helpers consume the same revision. Bootstrap, screen entry and controlled polling trigger refresh; managed images use revision URLs while known legacy images preserve existing static paths. Active server encounter/room revision pinning and production deployment remain separate. See [dynamic browser content](CONTENT_CLIENT.md).

## Phase 7 — protect ongoing gameplay (draft PR #15, 2026-11-07)

New server encounter and room snapshots retain the immutable content revision selected when the adventure starts. Prepared encounters, three multiplayer slot fates, active room system events, solo checkpoints and death/sacrifice recovery propagate that version. The resolver uses the original historical encounter/solution definitions for rewards and inventory operations even after the latest publication pointer changes. Untagged pre-publication records use the verified repository baseline, but deployment requires comparison with the real old production data. The publication validator also blocks deletions and semantic identity changes for established IDs, including during admin dry-run validation. See [ongoing gameplay protection](CONTENT_GAMEPLAY.md).

**Boundary:** The Phase 6 browser store continues revalidating current content; it does not yet render active-game item metadata against a historical pinned client snapshot. Real PostgreSQL/network concurrency, legacy data parity and the full release workflow remain unverified. The implementation is not deployed.

## Phase 8 — deployment and recovery (draft PR #16, 2026-11-07)

Application code, static web output, persistent published content and off-host backups now have explicit non-overlapping path boundaries. The guarded deployment runner validates those boundaries before Git pull, captures a verified content backup, builds and tests the application, syncs only client/dist to the static web root, and reloads PM2. It does not call the content administration API or change a content revision.

The backup utility retains every committed JSON revision, every artwork object referenced by historical manifests and the private admin audit log. It verifies file digests, revision manifests and the current pointer before committing a versioned backup. Restore writes only to a new root, validates it, and leaves the active root untouched until an operator changes the application environment.

A new Nginx include proxies immutable /game-data/media/ requests to the Express route, preserving API-provided ETag and cache headers. The private content root is never exposed with an Nginx alias. The repository has no production Nginx site configuration, so host integration remains manual. No actual deployment, backup mount or restore rehearsal has been performed. See [deployment and recovery](DEPLOYMENT_RECOVERY.md).
