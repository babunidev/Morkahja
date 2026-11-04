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
- [ ] **Restore release gate:** Address existing server TypeScript errors in encounter/solution tests, pending-level-up tests, and `roomService.ts` before calling the whole workflow green.
- [ ] **Manual acceptance:** Verify registration/recovery, gameplay, death/sacrifice, room reconnect, currency and reward conservation, and sessions after integration; do not claim this from focused automated tests alone.
- [ ] **Further integrity and security work:** Investigate Stripe fulfillment idempotency, room joins under contention, client-visible unrevealed dice/rewards, lore gem claiming, rate limiting and token/key handling.
- [ ] **Deferred, intentionally unchanged:** Smooth multi-tab, multi-avatar gameplay as an eventual supported feature. Existing simultaneous tabs are acceptable for now; verify independent encounter/inventory/progression state, reward conservation and session consistency before promising full support.

**Evidence boundary:** The Nobara developer reported the isolated game working and both automated security/persistence tests passing on 4 November. GitHub Actions checks succeeded individually but the complete typecheck failed; neither PR was merged or deployed.

## Integration review in progress — 4 November 2026

- [x] **Prepared on PR #7 (unmerged):** Fix the previously failing TypeScript fixtures and missing `SoloRoomCheckpoint` import. An initial CI run passed full server/shared typechecking; an expanded suite is under validation.
- [x] **Review correction (unmerged):** Persist initial avatar items and avatar state in the same PostgreSQL transaction; assert the returned inventory matches stored items. Deduplicate the daily blessing readiness notification under concurrent claims.
- [x] **Added to CI:** Encounter resolver/solution-consumption/level-up, room and starting-inventory test commands. Tests exposed stale assumptions about solo checkpoints, single-Continue level-ups, and bounded Scribes-feed counts; their expectations were corrected without changing intended rules.
- [ ] **Full expanded CI release gate:** Confirm the newest branch head passes all steps, including room suite and server typecheck.
- [ ] **Original local integration:** Reconcile unpublished commits and uncommitted changes safely in a separate worktree. Do not mark the original checkout integrated until done.
- [ ] **Manual acceptance:** Execute the [integration regression protocol](docs/REGRESSION.md) and record real player, avatar, room, reward and death results. No production deployment has occurred.

**Previous October audit headings are historical** and do not override the more recent status above.

### Verified integration CI result — 4 November 2026

- [x] **Expanded release gates on PR #7:** GitHub Actions [run #78](https://github.com/babunidev/Morkahja/actions/runs/41766441723) passed all listed workflow steps at `b2aac235`, including TypeScript, client build, room/inventory, level-up, security and persistence tests.
- [ ] **Investigate intermittent room test:** An earlier run occasionally observed an unexpected room state after a guest departed with its prepared choice committed. The later run passed; the precise race or fixture precondition remains unverified.
- [ ] **Original Nobara working-tree integration:** PRs #5, #6 and #7 remain unmerged; unpublished local commits and uncommitted changes have not been reconciled.
- [ ] **Full manual browser acceptance:** The steps in [docs/REGRESSION.md](docs/REGRESSION.md) must be executed against the actual combined local checkout. No deployment is certified.

- [x] **Latest expanded CI after room-fixture stabilization:** [Run #80](https://github.com/babunidev/Morkahja/actions/runs/41766927692) passed all steps on integration commit `e434b78`.
- [ ] **Further room-stress verification:** Randomized guest-leave testing had an intermittent failure before the fixture was constrained to favorable dice. The fixture now verifies its intended state transition; investigate the broader randomized edge case separately. This does not block the verified deterministic regression, but it does not certify every random encounter path.
