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

## Current persistence and authentication work — unmerged (4 November 2026)

This section describes the implementation on the PR branches, **not yet `main` or production**.

- **Authentication, [PR #5](https://github.com/babunidev/Morkahja/pull/5):** `server/src/services/sessionService.ts` requests/consumes time-limited single-use challenges stored in PostgreSQL `session_auth_challenges`. The client signs the same bound challenge with identity and device keys. The recovery-key file format is unchanged. A fresh isolated database contains no existing player accounts; old keys cannot restore records that are not there.
- **Atomic document writes, [PR #6](https://github.com/babunidev/Morkahja/pull/6):** `server/src/db/postgresDocumentStore.ts` uses single-statement `INSERT ... ON CONFLICT DO UPDATE` with `jsonb ||` for top-level `setPlayer` and `setAvatar` patches (both direct and transactional paths). This removes the stale application-side read/merge/write window for independent top-level properties.
- **Nested state and multi-row state:** JSONB `||` is a *shallow* merge; it does not atomically increment nested `currencies`, `dailyReward`, `loreGemClaims`, `progression` or `inventory`. Currency mutations already use `withDocumentTransaction`; the PR moves relevant other operations to row-locked reads before recalculation. Session changes lock the player, then write player/session records together. Avoid stale full-document saves in other services.
- **Tests and limits:** `server/src/tests/atomicDocumentWrites.test.ts` exercises concurrent player/avatar patches, an avatar nested counter, daily encounter progress, unique gem grants, donations, heartbeats and logout. Run `DATABASE_URL=postgres://postgres:postgres@localhost:4242/morkahja npm run test:persistence --prefix server` and `npm run test:session-auth --prefix server` with that environment exported. These passed in GitHub Actions and on Nobara with Podman PostgreSQL. Other CI steps (achievements, dice, static data, client build) passed; the full server typecheck remains blocked by pre-existing TypeScript errors.
- **Session tabs:** Multiple browser tabs may share one player session and operate on different avatars. This is observed and intentionally left unchanged, not validated as a complete multi-avatar concurrency design.

**Safeguard:** Keep the developer's original worktree and data separate from PR test worktrees. Database/schema, session data, purchase flows, rewards and active rooms warrant targeted concurrency tests before merging into a production deployment.

## Integration review corrections — PR #7 (unmerged, 4 November 2026)

- Current `savePlayerAvatar` integration code constructs the avatar and its initial inventory from the locked database state and writes both together in one PostgreSQL transaction. The returned starting inventory must equal the persisted inventory; tests assert this equality to prevent transient empty starter items.
- The existing solo system-event path advances after a single successful Continue; regression fixtures use independent avatars to avoid restoring the previous system-event checkpoint. Scribes activity feeds are bounded, so tests check newly recorded event IDs rather than counting every historical event in the window.
- The test runner now covers session authentication, atomic persistence, achievements, dice, encounter/solution, level-up, room and inventory cases. The comprehensive manual browser acceptance remains **unverified**. See [regression protocol](REGRESSION.md).
- Existing `pg` warnings about concurrent `client.query()` on the same transaction client warrant separate future maintenance; do not confuse a deprecation warning with verified data loss.
