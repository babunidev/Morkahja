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


## Deployment — game under babuni.dev (planned 2026-11-09, implemented locally 2026-11-10)

**Target selected by Babuni:** `https://www.babuni.dev/Morkahja/` (decided 2026-11-10, replacing the original `https://babuni.dev/Morkahja/`), with the main website remaining at `https://www.babuni.dev/`.

**Status:** **Deployed and verified live on 2026-11-10** from branch `feat/babuni-dev-subpath` (commit `95fd5c5a`). The branch was merged into `main` later that day as PR #19 (`1d35f4a9`). The production backend was upgraded from June commit `77062a42` at the same time. Public discovery found the apex `babuni.dev` parked, so Babuni chose `www.babuni.dev`; no DNS was changed.

- [x] **Hostname decided:** `www.babuni.dev/Morkahja/`. Public DNS/HTTP were inspected; no DNS was changed. *(Optional later: redirect the apex to `www` if it is ever connected.)*
- [x] Server inspected: website, game API (PM2) and PostgreSQL 18 share one host; Stripe is enabled; the backend needed an upgrade.
- [x] Off-host PostgreSQL backup restored into PostgreSQL 18 with matching row counts; `.env`, Nginx files and `server/game/*.json` backed up; upgrade rehearsed against the restored copy.
- [x] Vite production base `/Morkahja/`; production API base defaults to `/Morkahja/api`; local development unchanged.
- [x] Base-aware runtime asset URLs for all client and server-provided asset paths, with a regression test against new unwrapped root paths.
- [x] PWA `start_url`/`scope`/icon resolve beneath `/Morkahja/`; social-preview fallback is `https://www.babuni.dev/Morkahja` and the broken preview image reference is fixed.
- [x] Nginx location template for `/Morkahja/`, `/Morkahja/api/` (prefix stripped) and redirects. `nginx -t` passed and routing was verified locally.
- [x] Express `trust proxy` (default `loopback`) so the per-IP auth/heartbeat rate limit is not shared by all players behind the proxy.
- [x] Recovery-key restoration recovered the same player record in a fresh browser profile (local test database).
- [x] Deployed: frontend in an isolated release directory behind a symlink, Nginx include, backend upgraded with a health gate and scripted rollback.
- [x] Live verification: website, game, assets, API, onboarding, logout, deep links, recovery-key restore of a new player, and an encounter turn.
- [x] Gameplay hotfix `0d217fc7` (turns stalled after a choice) deployed and verified live by real clicks, including a level-up system event.
- [x] Stripe webhook endpoint updated to the new URL (both checkout events).
- [ ] Confirm the first real checkout return and signed delivery.
- [x] Babuni restored their own **pre-migration** account with its recovery key at the new URL (manual, user-reported).
- [x] Merge the branch into `main` (PR #19, `1d35f4a9`, 2026-11-10).
- [x] Return the server checkout to `main`: released backend and frontend together on 2026-11-11 (`5e5481f7`), which put the server-owned game content (#18) live. Because `main` now includes PR #18 (game content served by the server), this means deploying **backend and frontend together**; a frontend-only release of current `main` would not load content from the deployed backend. See [the next-deployment notes](docs/DEPLOYMENT.md#next-deployment-game-content-from-the-server-pr-18).
- [ ] PWA install, two-person multiplayer and mobile browsers at the live URL.
- [ ] Assess and address same-origin risks (origin-wide `localStorage` holding identity keys, no CSP/HSTS on the website today). *(Documented; not changed.)*

See [the deployment plan](docs/DEPLOYMENT.md) for discovered infrastructure, configuration, deployment and rollback procedure, the security assessment and exact verification results.

## Active engineering priorities — 2026-11-04 (separate from October documentation audit)

- [x] **Implemented in PR #5; unmerged:** Server-issued, single-use signed authentication challenges. CI session-auth tests and Nobara local session-auth tests passed. Existing-account recovery against a populated player database and production deployment remain unverified.
- [x] **Implemented in PR #6; unmerged:** Atomic top-level PostgreSQL player/avatar JSONB writes and row-locked state mutations; concurrency regression test passed in CI and locally using Nobara + Podman + PostgreSQL.
- [ ] **Integrate safely:** Review/merge PR #5, then PR #6 (PR #6 targets PR #5), reconcile with the developer's unpublished local commits and modified files, and test the resulting combined codebase before release.
- [x] **Fix pre-existing TypeScript diagnostics (PR #6, unmerged):** Correct encounter/solution test fixture types, explicit progression test reads, and a missing checkpoint type import. Full release-gates workflow passed in GitHub Actions run #69 at `c9a1c311`; integration and local manual acceptance remain pending.
- [x] **Room regression phase correction (PR #6 branch):** Late joiner `witnessing` assertion passed complete CI run #82.
- [x] **Validate solo-room event regression in reused databases:** PR #6 counts persisted events for the test player/avatar rather than the 50-entry Scribes feed. CI run #84 passed. On 4 November, the developer merged the corrected branch into the isolated Nobara `integration/priority-1` worktree and reran `npm run test:rooms --prefix server` against the existing PostgreSQL database: `roomService.test.ts`, `soloRoomCheckpointService.test.ts`, and `avatarDeathService.test.ts` all passed.
- [x] **Reverify restored test entrypoints (PR #6):** The corrected encounter fixture fallback, next-active-encounter lifecycle runner and client visible-reward unit test passed CI run #87 attempt 2 and also passed on Nobara on 4 November in the isolated `integration/priority-1` worktree, after the five original gameplay edits were committed locally as `25aa8feb` and the PR branch changes were merged. `test:rooms`, `test:persistence` and `release:check` also passed in that same local run. **Open:** CI run #87 attempt 1 failed `roomService.test.ts:1214` on an unchanged commit; investigate the intermittent host-advancement state.
- [x] **Reconcile original local source edits in isolated integration:** Five files (encounter image, visible rewards and its test, room service and its test) were applied from a normalized local patch and committed **only on Nobara** as `25aa8feb`. Local tests passed after the subsequent PR #6 merge. The editor-only `.obsidian/workspace.json` change was intentionally excluded. Original `MorkahjaWebApp` checkout remains dirty and was not reset. This local commit has not been pushed or included in remote PR #6.
- [x] **Manual browser registration and new-account restoration (Nobara integration):** The developer checked all ten steps for new player registration, recovery-key download, avatar creation, restoration in a separate browser profile, recovery of the original player/avatar, and preservation of recorded inventory, progression and gem balance. This is user-reported manual acceptance, not an independent automated end-to-end execution. **Legacy account created before the authentication change was not tested** (unchecked eleventh checklist item).
- [x] **Manual core gameplay acceptance (Nobara integration):** On 4 November, the developer reported verifying the previously requested browser checks for encounter resolution, inventory changes, progression, achievement bonuses and rewards. This is user-reported manual acceptance, not separately instrumented proof of each reward or state transition.
- [ ] **Remaining manual acceptance:** Restore an existing pre-update account with its original recovery key when an appropriate test record is available; separately verify avatar death/sacrifice and multiplayer reconnection. Core gameplay verification does not establish these additional scenarios.
- [x] **Priority 2 — Isolate intermittent room regression fixture (PR #6):** Earlier tests created overlapping synthetic rooms for the same original avatar, while the active-room lookup sorts only by millisecond `updatedAt`. Guest departure/rejoin now runs under an independent test host; it asserts the actual room, choice/focus state and Continue transition without weakening the gameplay invariant. **Verified:** GitHub Actions runs [#93](https://github.com/babunidev/Morkahja/actions/runs/41884012574) and [#94](https://github.com/babunidev/Morkahja/actions/runs/41884344700) passed; each ran the complete room suite three times. **Nobara reverified:** Three more room-suite runs passed after merging the PR #6 update into the isolated local integration worktree. Production multi-room lookup and room joins under contention remain a separate concurrency audit.
- [x] **Priority 2 — Remove overlapping PostgreSQL transaction queries (PR #6):** `encounterGenerator.ts` now sequences its row-locked reads for both solo resolution and room outcome preparation. CI run #94 passed three full room suites and the lifecycle test under `NODE_OPTIONS=--throw-deprecation`. Logs contain no overlapping `client.query()` deprecation. **Nobara reverified:** Three consecutive room-suite runs and `test:lifecycle`, all with `NODE_OPTIONS=--throw-deprecation`, passed without the PostgreSQL warning. Persistence concurrency and the complete release check also passed. Other Node warnings observed in earlier CI are outside this fix.
- [x] **Priority 2 — Stripe webhook idempotency (PR #6):** Atomic Checkout Session/event/purchase/entitlement transaction; covers interrupted grant rollback, retry, concurrent fulfillment, duplicate deliveries, event replays and older claimed-but-unrecorded events. Both standard completion and asynchronous payment success events are accepted only after successful payment. **Verified in GitHub Actions run #105:** Commerce rollback, retry, concurrent deliveries, session dedupe and cross-session replay tests passed. **Nobara integrated verification passed on 4 November:** `npm run test:commerce --prefix server` (including the Stripe fulfillment test). A live signed Stripe test-mode webhook remains unverified.
- [x] **Priority 2 — Prevent unrevealed dice/reward disclosure (PR #6):** Redact rolls, preselected rewards and uncommitted teammate outcomes from room and legacy encounter HTTP snapshots until the viewer's choice is revealed. Server-side fate unchanged. **Verified in CI run #105:** Three complete room regression suites, including pre-choice fate and teammate-result redaction checks. **Nobara integrated verification passed:** `NODE_OPTIONS=--throw-deprecation npm run test:rooms --prefix server`, including the API response redaction checks. Browser reveal animation remains unverified.
- [x] **Priority 2 — Lore gem abuse protection (PR #6):** Enforce server deadline, row-lock room activation, and grant gem rewards in the room-commit transaction with one player-specific claim key. Added early and concurrent duplicate claim tests. **Verified in CI run #105 and on Nobara:** Local `test:rooms` included `loreGemSecurity.test.ts` and passed with deprecation warnings configured as errors.
- [x] **Priority 2 — Atomic party slot joins (PR #6):** Row-lock room membership and slot assignment, validate permissions while locked, and remove stale room saves in associated flows. Three competing joiners for two slots and repeat joins are regression-tested. **Verified in CI run #105 and on Nobara:** Local room suite, including competing-join and slot checks, passed. Same-player joins to different rooms, production network races and broader cross-room workflows are not yet proven. Same-player joins to different rooms, production network races and broader cross-room workflows are not yet proven.
- [ ] **Further security work:** Audit rate limiting, token/key handling, production Stripe test-mode webhook delivery, cross-room same-player joins and other concurrent encounter/room operations.
- [ ] **Deferred, intentionally unchanged:** Smooth multi-tab, multi-avatar gameplay as an eventual supported feature. Existing simultaneous tabs are acceptable for now; verify independent encounter/inventory/progression state, reward conservation and session consistency before promising full support.

**Evidence boundary:** Developer-provided Nobara terminal output on 4 November confirms `test:encounter`, `test:lifecycle`, `test:visible-rewards`, `test:rooms`, `test:persistence` and `release:check` all passed together in the isolated local worktree with commit `25aa8feb` and the current PR #6 test-runner changes. This verifies the combined **local** automated source checks; subsequent user-reported browser registration and new-account recovery checks passed, while pre-update legacy recovery and the remaining death/sacrifice and multiplayer-reconnection scenarios remain unverified; core gameplay is now user-reported as manually verified. The five-file local commit is unpublished; PR #5 and PR #6 remain unmerged into `main` and nothing was deployed. The overlapping-transaction `pg` deprecation and isolated fixture intermittency have been corrected and reverified locally and in CI, though no guarantee is made about unrelated concurrent production room-join behavior. The non-fatal room placeholder-avatar test diagnostic still appears.

**Additional integrated acceptance — 4 November 2026:** The developer's isolated `integration/priority-1` worktree reported a clean `git status` before fetch and `Already up to date` when merging the current PR #6 branch. The supplied Nobara terminal output shows passing `test:commerce`, `test:rooms` (including lore-gem security), `test:lifecycle`, `test:persistence` and `release:check` on PostgreSQL, with room and lifecycle under `NODE_OPTIONS=--throw-deprecation` and no overlapping-query warnings. No Stripe test-mode webhook delivery or browser animation acceptance occurred in these commands. The main checkout, live environment and PR merge state are unchanged.

## Game screen from the standalone version (branch `feat/standalone-layout`, 2026-11-11)

Babuni's decisions D-010 and D-011; details in [CHANGELOG.md](CHANGELOG.md) and the [journal](docs/DEVLOG.md).

- [x] Three-zone game screen on a fixed 9:16 canvas, framed encounter picture, title on hover, party strip with essence lives, action menu (Get help, Inventory, Skillbook, Lore). Accepted by Babuni after local play.
- [x] Result redesign: spent solutions fly into the encounter, rewards grow out of it into the solution slots (order 3, 2, 4, 1, 5), losses arrive from the avatar or their button, collect-to-continue, ready wobble, cross-faded landings.
- [x] Fixes found while testing: Call for help skipped players with a paused solo room; endless render loop in the party strip; replaying spending animation.
- [x] Development bots for multiplayer testing (always playing, waiting helper, on-and-off player), using items, then skills, then dice.
- [ ] Mobile layout pass: the standalone targeted desktop; phones take a separate full-screen path and some sizes are fixed pixels on the 390-wide canvas.
  - [x] First step (2026-11-12): the game screen and notifications are centred and fit the screen on phones; still to check on real devices, and the dashboard and overlays on phones.
  - [x] Welcome screen and avatar creation fit and are centred on phones (2026-11-12); avatar creation rearranged to Babuni's layout.
- [ ] Line frame with wait timer on the bottom edge (D-013): implemented locally 2026-11-12, waiting for Babuni's play test and release.
- [ ] The same line frame on every panel, menu and tooltip (D-014): implemented locally 2026-11-13, waiting for Babuni's look and release.
- [ ] Simple frame on buttons, fields, cards and bars, frame dividers, patch notes since beta.2.2, version 0.9.0-beta.42 (D-015): implemented locally 2026-11-13, waiting for Babuni's look and release.
- [ ] Hover seam fix, framed title picker, Friends fixes, 0.9.0-beta.43: implemented locally 2026-11-13, waiting for Babuni's look and release.
- [x] No flash in the encounter's corner before solution and reward flights, 0.9.0-beta.52 (Babuni's bug report): checked frame by frame in headless Chromium and released 2026-11-13; still to see in the game and on a real phone.
- [ ] Encounters that need several solutions, chosen one at a time (D-019), 0.9.0-beta.53: released 2026-11-13 for Babuni's tests with high-level accounts. Still to check: a party with other players choosing sets.
- [ ] Smooth fades, menus that open once loaded, inventory taps on phones, About Us and costs update (D-020), 0.9.0-beta.54: released 2026-11-13.
- [ ] Terms and privacy policy rewritten to match the game, "Use Your Key" (D-021), 0.9.0-beta.54: released 2026-11-13. Open: consent to immediate delivery at checkout, if the right of withdrawal should ever be excluded.
- [ ] Solution sets reveal each roll on arrival, picks locked (D-025), 0.9.0-beta.56: implemented locally 2026-11-14; waiting for Babuni's play test and release. Still to check: sets in a party.
- [ ] Website: a clear "Play" link to the game on the babuni.dev Morkahja page (for the website developer).
- [ ] Website: a deep link that opens the living grid at the Morkahja project with its changelog reader (none exists yet; for the website developer). Then point the patch notes' "Full changelog" at it.
- [ ] Frame timer in two phases, 0.9.0-beta.44: implemented locally 2026-11-13, waiting for Babuni's play test and release.
- [ ] Two real players, and touch screens (first tap may show a tooltip before collecting).
- [x] Fixed and released (`e78cde2f`, 2026-11-11): a level-up event could be played twice after leaving or reloading mid-event (rewards twice).
- [ ] Open game issue, found with the bots: a prepared round result carries a full copy of the avatar and saves it back when the round is committed, undoing any avatar change made in between (for example a display title). Needs a field-level save and a regression test.
- [ ] Optional: the same render-loop fix in the standalone version, which has the same party-strip code.
- [x] Merged into `main` (PR #24) and released backend and frontend together on 2026-11-11 (`a40a6c5c`).
- [x] Bot adventurers online in production (D-012), with `morkahja-deploy bots-status|bots-start|bots-stop`.
- [x] Decided: the bot adventurers stay unmarked (D-012); they appear in the activity feed like players. Their effect on achievements is not reviewed.
