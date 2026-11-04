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
- [ ] **Room regression gate:** The first Nobara integration run failed `roomService.test.ts:1228`, where the test assumed a late guest was `choosing` even when the host had advanced to `system_event`. PR #6 now checks the documented `witnessing` rule and includes `test:rooms` in CI; rerun the full suite against the corrected branch before treating it as verified.
- [ ] **Manual acceptance:** Verify registration/recovery, gameplay, death/sacrifice, room reconnect, currency and reward conservation, and sessions after integration; do not claim this from focused automated tests alone.
- [ ] **Further integrity and security work:** Investigate Stripe fulfillment idempotency, room joins under contention, client-visible unrevealed dice/rewards, lore gem claiming, rate limiting and token/key handling.
- [ ] **Deferred, intentionally unchanged:** Smooth multi-tab, multi-avatar gameplay as an eventual supported feature. Existing simultaneous tabs are acceptable for now; verify independent encounter/inventory/progression state, reward conservation and session consistency before promising full support.

**Evidence boundary:** The Nobara developer reported the isolated game working and both automated security/persistence tests passing on 4 November. GitHub Actions checks succeeded individually but the complete typecheck failed; neither PR was merged or deployed.
