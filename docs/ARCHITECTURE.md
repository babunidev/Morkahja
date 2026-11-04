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
- **Tests and limits:** `server/src/tests/atomicDocumentWrites.test.ts` exercises concurrent player/avatar patches, an avatar nested counter, daily encounter progress, unique gem grants, donations, heartbeats and logout. Run `DATABASE_URL=postgres://postgres:postgres@localhost:4242/morkahja npm run test:persistence --prefix server` and `npm run test:session-auth --prefix server` with that environment exported. These passed in GitHub Actions and on Nobara with Podman PostgreSQL. Other CI steps (achievements, dice, static data, client build and full server typecheck) passed in later PR #6 runs.
- **Session tabs:** Multiple browser tabs may share one player session and operate on different avatars. This is observed and intentionally left unchanged, not validated as a complete multi-avatar concurrency design.

**Safeguard:** Keep the developer's original worktree and data separate from PR test worktrees. Database/schema, session data, purchase flows, rewards and active rooms warrant targeted concurrency tests before merging into a production deployment.

### Standalone encounter/lifecycle test assumptions (PR #6)

`runEncounterTest.ts` accepts an optional local player JSON fixture but supplies a deterministic in-memory dice fixture when it is absent, so a clean checkout can execute it. `runEncounterLifecycle.ts` now checks the actual `continueEncounter` contract: resolve/commit and persist a *different active* encounter snapshot, rather than retaining a resolved snapshot and invoking intentionally disabled `clearEncounter()`. Its generated test IDs avoid changing the pre-existing `test-player` test account by default. The client rewards unit test requires the `client/tsconfig.app.json` `@shared` path aliases when run through `tsx`. These are test-only adaptations; original runtime behavior and manual gameplay remain unverified.

### Release-gate type maintenance (PR #6)

The historic server typecheck diagnostics came from tests using outdated fixture shapes (encounter/solution reward types and required metadata), untyped `getProgression` values and a missing `SoloRoomCheckpoint` type import. The PR updates those declarations without changing encounter resolution or room runtime semantics. GitHub Actions release-gates run #69 passed all steps on PR #6 at commit `c9a1c311`. The integrated local worktree and production have not been validated.

### Solo-room Scribes event regression

The public Scribes feed queries a rolling window of up to 50 events across global and player-relevant traffic. On an existing database, asserting that a particular event type grows by exactly one in that feed can fail when an older entry leaves the window. The solo-room rejoin regression uses a parameterized `game_events` table count filtered by test player, avatar and event type, checking persisted behavior without changing the feed presentation policy. The corrected PR branch passed GitHub Actions run #84, including the complete room suite. The updated Nobara integration worktree passed `npm run test:rooms --prefix server` on 4 November against the existing populated PostgreSQL test database; all three room test scripts passed. The `pg` client deprecation warning persists, and full manual gameplay remains unverified.

### Joining during an active system event (PR #6 regression test)

`roomService.ts:createParticipantForRoomJoin` returns a regular `choosing` participant for ordinary rooms and for the system event's acting player. A non-acting participant joining while `roomState === 'system_event'` is placed in `witnessing` and receives no prior prepared result. This behavior predates the November test correction. `roomService.test.ts` now asserts the correct phase-aware state instead of assuming every fresh rejoiner is choosing. GitHub Actions run #82 executed and passed the room suite with this assertion; it does not establish that every multi-tab or concurrent room transition is safe.

### CI room-test intermittency (4 November 2026)

GitHub Actions run #87 attempt 1 failed the pre-existing host-advancement assertion in `roomService.test.ts:1214`; attempt 2 passed with unchanged source and the newly added smoke checks. The exact timing/state condition is not yet isolated. Room advancement depends on participant choice/continue status, focus and pending system events. Preserve the failing invariant and investigate its intermittent outcome before considering the full multiplayer transition coverage deterministic. The CI retry is proof of one successful run, not of race freedom.

### Isolated Nobara integration verification (4 November 2026)

After excluding CRLF/LF line-ending churn, the developer applied five source changes from the original worktree and committed them **locally only** as `25aa8feb` on `integration/priority-1`. The remote PR #6 does **not** contain that local commit. Once the corrected test scripts were merged locally, the developer-provided terminal output showed success for the encounter resolver smoke test, persistent next-encounter lifecycle, client visible-reward unit test, all three room tests, PostgreSQL concurrency, and the full release gate (including typecheck and client build). This is integrated local automated verification on the existing Nobara test database, not an end-to-end account recovery or gameplay acceptance test. The earlier CI-only host-advancement failure, PostgreSQL client deprecation, and eventual merge/deployment remain open.

### Priority 2 query ordering and room regression fixture (4 November 2026)

The encounter engine calls row-locking `DocumentTransaction` getters over one checked-out PostgreSQL client. Firing these getters via `Promise.all` causes overlapping `client.query()` calls and a deprecation warning with the installed `pg` version. Solo resolution and multiplayer outcome preparation now read avatar, inventory, progression and player state sequentially; these checks preserve the transaction lock scope and do not change reward calculations. In the room regression suite, multiple synthetic open rooms for the same avatar can contend in the `updatedAt`-only lookup; the guest-departure test now seeds a dedicated host and asserts the intended room/phase/focus before advancing. The runtime room lookup is not changed, and concurrent room joins remain separately unverified. **Verified:** CI runs #93 and #94 passed three complete room-suite repetitions each. Run #94 also passed room and lifecycle tests with deprecations treated as errors. The local Nobara combined integration has not yet been retested after these PR #6 updates.
