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
- [x] **Reverify restored test entrypoints (PR #6):** The corrected encounter fixture fallback, next-active-encounter lifecycle runner and client visible-reward unit test passed CI run #87 attempt 2 and also passed on Nobara on 4 November in the isolated `integration/priority-1` worktree, after the five original gameplay edits were committed locally as `25aa8feb` and the PR branch changes were merged. `test:rooms`, `test:persistence` and `release:check` also passed in that same local run. **Open:** CI run #87 attempt 1 failed `roomService.test.ts:1214` on an unchanged commit; investigate the intermittent host-advancement state.
- [x] **Reconcile original local source edits in isolated integration:** Five files (encounter image, visible rewards and its test, room service and its test) were applied from a normalized local patch and committed **only on Nobara** as `25aa8feb`. Local tests passed after the subsequent PR #6 merge. The editor-only `.obsidian/workspace.json` change was intentionally excluded. Original `MorkahjaWebApp` checkout remains dirty and was not reset. This local commit has not been pushed or included in remote PR #6.
- [ ] **Manual acceptance:** Verify registration/recovery on an existing-account test database, gameplay, death/sacrifice, room reconnect, currency and reward conservation, and sessions after integration; do not claim this from focused automated tests alone.
- [ ] **Further integrity and security work:** Investigate Stripe fulfillment idempotency, room joins under contention, client-visible unrevealed dice/rewards, lore gem claiming, rate limiting and token/key handling.
- [ ] **Deferred, intentionally unchanged:** Smooth multi-tab, multi-avatar gameplay as an eventual supported feature. Existing simultaneous tabs are acceptable for now; verify independent encounter/inventory/progression state, reward conservation and session consistency before promising full support.

**Evidence boundary:** Developer-provided Nobara terminal output on 4 November confirms `test:encounter`, `test:lifecycle`, `test:visible-rewards`, `test:rooms`, `test:persistence` and `release:check` all passed together in the isolated local worktree with commit `25aa8feb` and the current PR #6 test-runner changes. This verifies the combined **local** source, not account recovery or manual gameplay. The five-file local commit is unpublished; PR #5 and PR #6 remain unmerged into `main` and nothing was deployed. A `pg` client deprecation warning, a non-fatal room placeholder-avatar diagnostic and CI room-test intermittency remain unresolved.
