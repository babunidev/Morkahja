# Morkahja — evidence-based roadmap

**Author:** Babuni.dev

## Existing source

Node workspaces include client, server and shared; scripts include encounter tests, lifecycle tests, a release check and typechecking. The current root package declares a 0.9.0 beta version.

## Unverified

This documentation audit did not launch the web client or server, perform database migrations, run the stated tests or inspect private production services. No feature is promoted to working solely because a component exists.

## Proposed validation

Run documented static and lifecycle checks in an appropriate development environment; independently verify account/session security and game-data version consistency.

## Post-audit work, not yet verified (2026-10-27)

- [x] Preserve the detailed original root `DEVLOG.md` as historical source.
- [x] Add separate visual-design and content-provenance reference documents.
- [x] Establish evidence-backed milestones from the May–June 2026 original journal.
- [ ] Execute `npm run release:check`, `npm run test:encounter` and `npm run test:lifecycle` on a suitable clean checkout; archive exact outputs.
- [ ] Independently test current browser interface, avatar death/recreation, encounter/dice outcomes, achievements, expansions and friends.
- [ ] Verify production architecture, backups, session/authentication safeguards, rate limits and privacy before treating historical alpha/deployment notes as present security certification.
- [ ] Curate an approved lore, content and image-credit inventory for the portfolio without publishing private player information.
- [ ] Cross-reference material design decisions in dated source/commits; do not infer author acceptance of every implementation detail.

**Audit boundaries:** Documentation-only source review. No builds, tests, live server calls or production data access.

## Active engineering priorities — 2026-11-04 (separate from October documentation audit)

- [x] **Implemented in PR #5; unmerged:** Server-issued, single-use signed authentication challenges. CI session-auth tests and Nobara local session-auth tests passed. Existing-account recovery against a populated player database and production deployment remain unverified.
- [x] **Implemented in PR #6; unmerged:** Atomic top-level PostgreSQL player/avatar JSONB writes and row-locked state mutations; concurrency regression test passed in CI and locally using Nobara + Podman + PostgreSQL.
- [ ] **Integrate safely:** Review/merge PR #5, then PR #6 (PR #6 targets PR #5), reconcile with the developer's unpublished local commits and modified files, and test the resulting combined codebase before release.
- [x] **Fix pre-existing TypeScript diagnostics (PR #6, unmerged):** Correct encounter/solution test fixture types, explicit progression test reads, and a missing checkpoint type import. Full release-gates workflow passed in GitHub Actions run #69 at `c9a1c311`; integration and local manual acceptance remain pending.
- [x] **Room regression phase correction (PR #6 branch):** Late joiner `witnessing` assertion passed complete CI run #82.
- [x] **Validate solo-room event regression in reused databases:** PR #6 counts persisted events for the test player/avatar rather than the 50-entry Scribes feed. CI run #84 passed. On 4 November, the developer merged the corrected branch into the isolated Nobara `integration/priority-1` worktree and reran `npm run test:rooms --prefix server` against the existing PostgreSQL database: `roomService.test.ts`, `soloRoomCheckpointService.test.ts`, and `avatarDeathService.test.ts` all passed.
- [ ] **Reverify restored test entrypoints (PR #6):** The Nobara integrated-source run passed release checks, rooms and persistence but found a missing local test-player fixture, an obsolete lifecycle assertion, and an unresolved `@shared` alias in a direct client unit-test invocation. The test-only corrections add a deterministic encounter fixture fallback, check the next active encounter, and run the client test using its tsconfig. **CI run #87 attempt 2 passed all tests**, including all three new checks. **CI attempt 1 failed the room-state assertion at `roomService.test.ts:1214`** despite earlier green runs; investigate this intermittency rather than weakening the invariant. Updated integrated-Nobara rerun remains pending.
- [ ] **Manual acceptance:** Verify registration/recovery, gameplay, death/sacrifice, room reconnect, currency and reward conservation, and sessions after integration; do not claim this from focused automated tests alone.
- [ ] **Further integrity and security work:** Investigate Stripe fulfillment idempotency, room joins under contention, client-visible unrevealed dice/rewards, lore gem claiming, rate limiting and token/key handling.
- [ ] **Deferred, intentionally unchanged:** Smooth multi-tab, multi-avatar gameplay as an eventual supported feature. Existing simultaneous tabs are acceptable for now; verify independent encounter/inventory/progression state, reward conservation and session consistency before promising full support.

**Evidence boundary:** Nobara's updated isolated integration worktree passed the room regression suite against its existing PostgreSQL test database, in addition to the previously reported release check and persistence test. GitHub Actions run #84 passed on the PR branch. Neither PR was merged into main or deployed; original-worktree uncommitted changes have not been integrated, and full manual gameplay regression remains pending.
