# Morkahja — evidence-based roadmap

**Author:** Babuni.dev

## Base game content completion — planned 2026-11-25

- [x] Record creative approval and artwork handoff for Round 1 Social encounter [20233 — A Name Upon the Wind](encounter-drafts/20233.md) (documentation only, 2026-11-27); artwork, activation and remaining metadata pending.

- [x] Record creative approval and artwork handoff for Round 1 Social encounter [20232 — Where Two Roads Meet](encounter-drafts/20232.md) (documentation only, 2026-11-27); artwork, activation and remaining metadata pending.

- [x] Reassess the post-D-066 catalog at 47 geographic encounters and 73 new needed while retaining the approved 120 target (2026-11-27). [Current allocation](CONTENT_COMPLETION_PLAN.md#2026-11-27--management-reassessment).
- [ ] Resolve remaining Trick/Combat classifications and Open Lock conversion candidates; reconcile future-round reservation allocations. Current Round 1 briefs remain valid.


- [x] Source audit and [content completion plan](CONTENT_COMPLETION_PLAN.md) for Ethera's Vale.
- [x] Record approved Ambush name and establish the [shared production ledger](CONTENT_PRODUCTION_LEDGER.md) with provisional family tasks and ID reservations.
- [x] Confirm Hidden Market as base-game Trade outside Aetherion; protect expansion 1004.
- [x] Approve and correct Hidden Market map placement in CSV and generated map entry.
- [x] Confirm 120 geographic encounters and family quotas.
- [x] Approve Performance as the third Social solution category; unblock creative drafting.
- [x] Approve nine encounters per principal-family subtype.
- [x] Replace the earlier fixed rarity/difficulty quotas with dynamic rare appearances: 5% chance and +1 effective difficulty, all authored Vale encounters D1 (2026-11-27).
- [x] Prepare [staged production rounds and Climb candidate review](CONTENT_PRODUCTION_ROUNDS.md) and [79-record regional assignment proposal](CONTENT_EXPANSION_ASSIGNMENTS.md).
- [x] Record approved Grove relocation and first three expansion catalog entries; prepare [regional migration brief](DEVELOPER_BRIEF_REGIONAL_EXPANSIONS.md) and [Climb conversion brief](DEVELOPER_BRIEF_CLIMB_CONVERSIONS.md).
- [x] Implement regional isolation safely (D-063, 2026-11-26): 78 encounters in ten inactive regional expansions, 20009 held, every path closed; [report](REPORT_REGIONAL_EXPANSIONS_2026-11-26.md). Released in 0.9.0-beta.84.
- [x] Decide the Evergrove review, 20009's land, gem prices, texts and banners (D-064, 2026-11-26); the ten regions are listed as coming soon. Released in 0.9.0-beta.84.
- [ ] Before a region opens: its encounters (planned 40 / 20 / 10 by size, D-064), real banner art if wanted, a money price and Stripe SKU if sold for money, regional ambiance recordings.
- [x] Climb Round 1 (20068, 20005, 20004) approved and applied (`77f4aaee`, 2026-11-26). Released in 0.9.0-beta.84.
- [x] Climb Round 2 (20080, 20071, 20088) approved and applied (2026-11-26). The base game now has six Climb encounters. Released in 0.9.0-beta.84.
- [x] Homecoming (D-065, 2026-11-26): 100 encounters with one avatar open its people's homeland. Released in 0.9.0-beta.84.
- [ ] The complete package: decide when to offer it and its price; it is the only way to buy a homeland (D-065).
- [ ] Implement [dynamic encounter rarity](DEVELOPER_BRIEF_DYNAMIC_ENCOUNTER_RARITY.md), normalize existing Vale sanctuaries to D1, and verify reward/frame/persistence and full N-action resolution (refillable slots or dice; no four-action design cap). Migrate taxonomy safely, review existing content and complete new encounters.
- [ ] Verify and release separately; documentation only at this stage.

## Fourth playable role — approved direction, not implemented (2026-11-25)

- [x] Record [Bard as the fourth role and Mage's Aid emphasis](DECISIONS.md#2026-11-25--bard-and-four-role-direction); Warrior favors Combat, Rogue Trick, Mage Aid and Bard Social.
- [ ] Define and approve the role-specific skill sets and reward pools, keeping race identity separate and reviewing existing Mage skills without removing owned solutions.
- [ ] Scope compatible implementation across avatar creation, shared/server role contracts, portrait IDs and assets, ambient audio, initial inventory, level-up rewards, persisted avatars and tests. Exact specialization restrictions and balance changes remain unapproved.
- [ ] Verify all four races and roles, old saves and reward paths before any release. No runtime changes in the documentation phase.

Artisan is a possible later addition, not a committed fifth role. Guardian remains a lore philosophy; it is not the selected fourth role.

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
- [x] Return the server checkout to `main`: released backend and frontend together on 2026-11-11 (`5e5481f7`), which put the server-owned game content (#18) live. Because `main` now includes PR #18 (game content served by the server), this means deploying **backend and frontend together**; a frontend-only release of current `main` would not load content from the deployed backend. See [the next-deployment notes](DEPLOYMENT.md#next-deployment-game-content-from-the-server-pr-18).
- [ ] PWA install, two-person multiplayer and mobile browsers at the live URL.
- [ ] Assess and address same-origin risks (origin-wide `localStorage` holding identity keys, no CSP/HSTS on the website today). *(Documented; not changed.)*

See [the deployment plan](DEPLOYMENT.md) for discovered infrastructure, configuration, deployment and rollback procedure, the security assessment and exact verification results.

## Active engineering priorities — 2026-11-04 (separate from October documentation audit)

- [x] **Implemented in PR #5; unmerged:** Server-issued, single-use signed authentication challenges. CI session-auth tests and Nobara local session-auth tests passed. Existing-account recovery against a populated player database and production deployment remain unverified.
- [x] **Implemented in PR #6; unmerged:** Atomic top-level PostgreSQL player/avatar JSONB writes and row-locked state mutations; concurrency regression test passed in CI and locally using Nobara + Podman + PostgreSQL.
- [ ] **Integrate safely:** Review/merge PR #5, then PR #6 (PR #6 targets PR #5), reconcile with the developer's unpublished local commits and modified files, and test the resulting combined codebase before release.
- [x] **Fix pre-existing TypeScript diagnostics (PR #6, unmerged):** Correct encounter/solution test fixture types, explicit progression test reads, and a missing checkpoint type import. Full release-gates workflow passed in GitHub Actions run #69 at `c9a1c311`; integration and local manual acceptance remain pending.
- [x] **Room regression phase correction (PR #6 branch):** Late joiner `witnessing` assertion passed complete CI run #82.
- [x] **Validate solo-room event regression in reused databases:** PR #6 counts persisted events for the test player/avatar rather than the 50-entry Scribes feed. CI run #84 passed. On 4 November, the developer merged the corrected branch into the isolated Nobara `integration/priority-1` worktree and reran `npm run test:rooms --prefix server` against the existing PostgreSQL database: `roomService.test.ts`, `soloRoomCheckpointService.test.ts`, and `avatarDeathService.test.ts` all passed.
- [x] **Reverify restored test entrypoints (PR #6):** The corrected encounter fixture fallback, next-active-encounter lifecycle runner and client visible-reward unit test passed CI run #87 attempt 2 and also passed on Nobara on 4 November in the isolated `integration/priority-1` worktree, after the five original gameplay edits were committed locally as `25aa8feb` and the PR branch changes were merged. `test:rooms`, `test:persistence` and `release:check` also passed in that same local run. **Open:** CI run #87 attempt 1 failed `roomService.test.ts:1214` on an unchanged commit; investigate the intermittent host-advancement state.
- [x] **Flaky `roomService.test.ts:571` (23 November 2026):** after Continue the room sometimes goes to a random `system_event` instead of `active_encounter`; it failed once in a full `npm test` and then passed 4 runs alone. Fixed 2026-11-24: the test accepts a level-up or Atranor after the dice roll and checks that the room left the played encounter; the full server suite passed (75/75).
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
- [x] **Gem-cheating review (2026-11-24, Claude Code, Claude Opus 5.5):** every gem grant and spend read in the source. Grants (lore gem, top roll, daily reward, Stripe) are decided by the server, keyed once per claim under the player row lock; Stripe checks the signature, pays only paid sessions once each, with server catalog prices. Spends (dice, expansions, travel, specialization, avatar edit, sacrifice, donation) work out the cost on the server and check the balance in the same locked transaction; no route merges request data into a player or avatar record; rolls stay hidden from a viewer until they have chosen. Hardened: an expansion whose price is not a whole number of 0 or more can no longer be bought (it could have added gems or set the balance to NaN; admin data only), and the admin key is compared in constant time. Source review plus the existing tests; no live or penetration test.
- [x] **Soul-link farming (decided D-062, 2026-11-24):** a link now pays only on a day when the new player and the soul-linked player have both played 42 encounters, at most one gift per soul-linked player a day. Fresh accounts can still be made, but each costs 42 played encounters and the main account must play 42 the same day. Released 2026-11-24 in 0.9.0-beta.83.
- [ ] **Deferred, intentionally unchanged:** Smooth multi-tab, multi-avatar gameplay as an eventual supported feature. Existing simultaneous tabs are acceptable for now; verify independent encounter/inventory/progression state, reward conservation and session consistency before promising full support.

**Evidence boundary:** Developer-provided Nobara terminal output on 4 November confirms `test:encounter`, `test:lifecycle`, `test:visible-rewards`, `test:rooms`, `test:persistence` and `release:check` all passed together in the isolated local worktree with commit `25aa8feb` and the current PR #6 test-runner changes. This verifies the combined **local** automated source checks; subsequent user-reported browser registration and new-account recovery checks passed, while pre-update legacy recovery and the remaining death/sacrifice and multiplayer-reconnection scenarios remain unverified; core gameplay is now user-reported as manually verified. The five-file local commit is unpublished; PR #5 and PR #6 remain unmerged into `main` and nothing was deployed. The overlapping-transaction `pg` deprecation and isolated fixture intermittency have been corrected and reverified locally and in CI, though no guarantee is made about unrelated concurrent production room-join behavior. The non-fatal room placeholder-avatar test diagnostic still appears.

**Additional integrated acceptance — 4 November 2026:** The developer's isolated `integration/priority-1` worktree reported a clean `git status` before fetch and `Already up to date` when merging the current PR #6 branch. The supplied Nobara terminal output shows passing `test:commerce`, `test:rooms` (including lore-gem security), `test:lifecycle`, `test:persistence` and `release:check` on PostgreSQL, with room and lifecycle under `NODE_OPTIONS=--throw-deprecation` and no overlapping-query warnings. No Stripe test-mode webhook delivery or browser animation acceptance occurred in these commands. The main checkout, live environment and PR merge state are unchanged.

## Game screen from the standalone version (branch `feat/standalone-layout`, 2026-11-11)

Babuni's decisions D-010 and D-011; details in [CHANGELOG.md](../CHANGELOG.md) and the [journal](DEVLOG.md).

- [x] Three-zone game screen on a fixed 9:16 canvas, framed encounter picture, title on hover, party strip with essence lives, action menu (Get help, Inventory, Skillbook, Lore). Accepted by Babuni after local play.
- [x] Result redesign: spent solutions fly into the encounter, rewards grow out of it into the solution slots (order 3, 2, 4, 1, 5), losses arrive from the avatar or their button, collect-to-continue, ready wobble, cross-faded landings.
- [x] Fixes found while testing: Call for help skipped players with a paused solo room; endless render loop in the party strip; replaying spending animation.
- [x] Development bots for multiplayer testing (always playing, waiting helper, on-and-off player), using items, then skills, then dice.
- [ ] Mobile layout pass: the standalone targeted desktop; phones take a separate full-screen path and some sizes are fixed pixels on the 390-wide canvas.
  - [x] First step (2026-11-12): the game screen and notifications are centred and fit the screen on phones; still to check on real devices, and the dashboard and overlays on phones.
  - [x] Welcome screen and avatar creation fit and are centred on phones (2026-11-12); avatar creation rearranged to Babuni's layout.
- [x] Line frame with wait timer on the bottom edge (D-013): implemented locally 2026-11-12, waiting for Babuni's play test and release. *(Babuni play-tests every change; confirmed 2026-11-24.)*
- [x] The same line frame on every panel, menu and tooltip (D-014): implemented locally 2026-11-13, waiting for Babuni's look and release. *(Babuni play-tests every change; confirmed 2026-11-24.)*
- [x] Simple frame on buttons, fields, cards and bars, frame dividers, patch notes since beta.2.2, version 0.9.0-beta.42 (D-015): implemented locally 2026-11-13, waiting for Babuni's look and release. *(Babuni play-tests every change; confirmed 2026-11-24.)*
- [x] Hover seam fix, framed title picker, Friends fixes, 0.9.0-beta.43: implemented locally 2026-11-13, waiting for Babuni's look and release. *(Babuni play-tests every change; confirmed 2026-11-24.)*
- [x] No flash in the encounter's corner before solution and reward flights, 0.9.0-beta.52 (Babuni's bug report): checked frame by frame in headless Chromium and released 2026-11-13; still to see in the game and on a real phone.
- [x] An Atranor resurrection item is spent, and the previous solution stack does not return on Atranor or a level-up (D-041), 0.9.0-beta.75. The inventory test passed. Not watched in a played turn before release. Released 2026-11-15 from `a6865336`.
- [x] A die in a longer set shows its roll when it arrives, then flies into the encounter with the solutions (D-040), 0.9.0-beta.74. The face rule, the room path and the Atranor reset are tested. Not watched in a played turn before release.
- [x] Each die in a longer set rises and hovers after its spin (D-037), 0.9.0-beta.73: the step test passed. Not watched in a played turn. Released 2026-11-15 from `c9d6d144`. The gold glow and the left tip of the stack went out in 0.9.0-beta.74.
- [x] A finished total of 25 adds one normal item, or two charges when five rewards are already granted (D-038), 0.9.0-beta.74. The rule is tested. Not played before release.
- [x] The dice and a solution both play for 1.73 seconds (D-036), 0.9.0-beta.71: client tests. Not watched in a played turn. Released 2026-11-15 inside 0.9.0-beta.72.
- [x] Changing expansion crossfades the weather (D-039), 0.9.0-beta.74: the new land fades in over one second while the old land fades out over two. The overlap is tested. Not heard before release.
- [x] Aetherion (1004) plays the edited weather filed as expansion 4, 0.9.0-beta.72: 12/16/12/12 pieces in stages A–D, game copies −38.6 to −37.9 LUFS. Not heard through a cycle. Released 2026-11-15 from `89afb765`. Urcogor (1002) is the land still without recordings.
- [x] Everwinter Valley (1003) plays the edited weather filed as expansion 3, 0.9.0-beta.70: the same 16/16/12/13 pieces, moved out of folder 2. Not heard through a cycle. Released 2026-11-15 inside 0.9.0-beta.72.
- [ ] Urcogor Ravage (1002) plays the edited weather filed as expansion 2, 0.9.0-beta.69: filed by mistake and moved to Everwinter in 0.9.0-beta.70. Urcogor has no recordings.
- [x] Keldor (1001), including Roarback Mauler, plays the weather filed as expansion 1, 0.9.0-beta.67: the lookup test passed 2026-11-15. Not heard through a cycle. Released 2026-11-15 inside 0.9.0-beta.68.
- [x] Each solution and each dice gap is its own roll (D-035), 0.9.0-beta.68: resolver and breakdown tests. Not played through in a browser. Released 2026-11-15 from `dccf8797`.
- [x] Stay in the current expansion on a d20 of 1–14 (D-033), 0.9.0-beta.66: selection test passed 2026-11-15. Not played. Released 2026-11-15 inside 0.9.0-beta.68.
- [x] Portrait result tooltip shows the face and the modifiers (D-034), 0.9.0-beta.66: breakdown tests passed 2026-11-15. Not hovered in a played turn. Released 2026-11-15 inside 0.9.0-beta.68.
- [ ] Encounters that need several solutions, chosen one at a time (D-019), 0.9.0-beta.53: released 2026-11-13 for Babuni's tests with high-level accounts. Still to check: a party with other players choosing sets.
- [ ] Smooth fades, menus that open once loaded, inventory taps on phones, About Us and costs update (D-020), 0.9.0-beta.54: released 2026-11-13.
- [ ] Terms and privacy policy rewritten to match the game, "Use Your Key" (D-021), 0.9.0-beta.54: released 2026-11-13. Open: consent to immediate delivery at checkout, if the right of withdrawal should ever be excluded.
- [ ] Solution sets reveal each roll on arrival, picks locked (D-025), 0.9.0-beta.56: released 2026-11-14. Still to check: sets in a party.
- [x] Inventory, skillbook and lore play at 90% of the volume they had, 0.9.0-beta.65: released 2026-11-15 inside 0.9.0-beta.68, waiting for a listen. Call for help is unchanged.
- [x] Weather bed and quieter effects, 0.9.0-beta.64 (D-032): stage rules tested. A full cycle was not heard. Keldor, Everwinter and Aetherion have folders. Urcogor does not. Released 2026-11-15 as 0.9.0-beta.72.
- [ ] Website: a clear "Play" link to the game on the babuni.dev Morkahja page (for the website developer).
- [ ] Website: a deep link that opens the living grid at the Morkahja project with its changelog reader (none exists yet; for the website developer). Then point the patch notes' "Full changelog" at it.
- [x] Frame timer in two phases, 0.9.0-beta.44: implemented locally 2026-11-13, waiting for Babuni's play test and release. *(Babuni play-tests every change; confirmed 2026-11-24.)*
- [ ] Two real players, and touch screens (first tap may show a tooltip before collecting).
- [x] Fixed and released (`e78cde2f`, 2026-11-11): a level-up event could be played twice after leaving or reloading mid-event (rewards twice).
- [x] Open game issue, found with the bots: a prepared round result carries a full copy of the avatar and saves it back when the round is committed, undoing any avatar change made in between (for example a display title). Fixed 2026-11-24: the commit saves only the round's fields onto the current avatar (`avatarAfterRound`); `roundKeepsAvatarChanges.test.ts` changes the name, title and specialization between choosing and Continue and keeps them (it fails on the old code). Released 2026-11-24 in 0.9.0-beta.83.
- [ ] Optional: the same render-loop fix in the standalone version, which has the same party-strip code.
- [x] Merged into `main` (PR #24) and released backend and frontend together on 2026-11-11 (`a40a6c5c`).
- [x] Bot adventurers online in production (D-012), with `morkahja-deploy bots-status|bots-start|bots-stop`.
- [x] Decided: the bot adventurers stay unmarked (D-012); they appear in the activity feed like players. Their effect on achievements is not reviewed.
- [x] Bots log a stuck room after 3 minutes, and leave it when another player is in it (released 2026-11-18).
- [x] Rooms stuck at `active_encounter` after everyone chose move on again on the next poll (released 2026-11-18; Thalyss and Varrokh play again). Which older code path stranded them is not known.
- [x] Closed and abandoned rooms are removed (D-048), released 2026-11-18: the first sweep removed 266 rooms.
- [x] Level-up reward choice (D-049): released 2026-11-18 in 0.9.0-beta.78, with the faster room sweep. Not yet tried: a party member watching another player's level-up choice.
- [x] Room updates arrive at once through a waiting request; inactivity leftovers removed (D-050); bots witness quietly and keep a player's pace. Released 2026-11-19 in 0.9.0-beta.79.
- [ ] Babuni to decide: should open Lore, Inventory or Skillbook keep pausing a party (D-050)?
- [ ] Release procedure: build the bundle only after the live encounter file has been reset, so Admin saves made in between are not dropped (happened to 20179 and 20180 on 18 November; restored).

## Encounter prose — 2026-11-16

- [x] Complete the remaining narrative descriptions after `20052`: 140 rewrites, preserving gameplay data and the earlier revised material (D-042).
- [x] Validate static content, catalog coverage, unchanged gameplay fields, and engraved-letter clues; record [scope and evidence](ENCOUNTER_REVISION.md).
- [x] Deploy through the documented release workflow. Released 2026-11-16 22:56 UTC from `a25ed410`.
- [ ] Read the revised paragraphs in the live game (not done at release).

## Region plate, title on arrival, weather cycle — 2026-11-17

- [x] Region plate on the encounter frame's top edge (D-043). Seen in local screenshots for the base game.
- [x] Encounter name fades in 1.3 s, holds 0.7 s, fades out 1.3 s when an encounter loads.
- [x] Ambiance stage cycle continues across lands. Unit-tested; not yet heard in play.
- [x] Babuni tested locally; released as 0.9.0-beta.76 (2026-11-17).
- [x] World map behind the region plate (D-044); placements in `docs/WORLD_MAP.md`.
- [ ] Babuni's review of the map's placements, especially the drawing choices (Fyrskar, Lovely Meadows, Deepstone Hollow).

## Solution artwork refresh — 2026-11-21 (D-051)

- [x] Confirm new format, per-solution review order and lore-aware design rules in [the solution image standard](SOLUTION_IMAGE_STANDARD.md).
- [ ] Rework and individually review existing solution imagery, starting with 10001 Arcane Intellect; 247 solution records and 268 illustration files were observed on `main` on 2026-11-21. This does not imply a one-to-one relation between records and files.
- [ ] Preserve each original until the replacement is approved; validate transparency, circle bounds, WebP dimensions, file size and a thumbnail rendering.
- [ ] Integrate approved WebPs with the existing solution-icon names, test the game and record separate deployment evidence. The future game-controlled frame overlay is not implemented in this documentation work.

## Solution picture frames — 2026-11-21

- [x] Round frames drawn by the game on top of every solution picture: standard, essence (four elements), rare; older pictures zoomed past their painted rim. Released in 0.9.0-beta.80 (2026-11-21).
- [x] Charges in a hexagon at each picture's bottom right: inventory, skillbook, encounter choices. Released in 0.9.0-beta.80.
- [x] Backup `20261121-135246` proven by a restore (row counts equal).
- [x] Backup `20261121-155015` proven by a restore (row counts equal).
- [x] Remade pictures marked frameless in the solution data (`mSolutionIconFrameless`), ticked by the admin tool on upload. Released in 0.9.0-beta.81.
- [ ] Babuni's review of the three frames and the element symbols.
- [ ] Babuni's confirmation of which items count as rare.
- [ ] Remake the remaining solution pictures without a painted frame (the admin tool marks each one on upload).
- [x] Frames on pictures in flight (rewards, losses, uses), the hovering used solution, the starfield and the avatar's inflow.
- [ ] Check in a played encounter and on a phone.

## Essences of the avatar's own element — 2026-11-21 (D-053)

- [x] New avatars start with the three essences of their race's element (Rokur fire, Verdani water, Aevis air, Grimnir earth).
- [x] Essences of other elements are lost first, two per loss; the last one alone; then the avatar's own, one per loss.
- [x] A total of 25 or higher: 20% chance of one extra essence of the avatar's element. Replaced by D-054: always, on 24 or higher.
- [x] Play it: a new avatar's essences, a Hardship with mixed essences, and a high roll. *(Babuni play-tests every change; confirmed 2026-11-24.)*
- [x] Released in 0.9.0-beta.82 (2026-11-21, 23:45 UTC).
- [ ] Prove backup `20261121-234506` by a restore.

## Balance pass — 2026-11-23 (D-054)

- [x] Primary slot +5 (was +7), secondary +2 (was +5), dice +0.
- [x] Rare items (rare frame) add +1 to their rolls; shown in the tooltip and the roll breakdown.
- [x] A total of 24 or higher always brings one essence of the avatar's element; the 25's extra item is gone.
- [x] Play it: a rare item's roll, a 24 or 25, and whether the game now feels hard enough. *(Babuni play-tests every change; confirmed 2026-11-24.)*
- [ ] Patch note and version bump, then release when Babuni approves.

## Main menu of avatars and the avatar overview — 2026-11-23 (D-058)

- [x] No Play button: the active avatar big, the other two below; a tap swaps; a tap on the active one opens the overview.
- [x] Overview in the menu (red back, green enter, shrinking into the avatar) and in the game (red back, Home), with statistics, equipment slots and room for the specialization.
- [x] Equipment slots the size of the solutions and the Inventory pictures.
- [ ] Babuni decides whether the dark red background stays for the Inventory, Skillbook and Lore (a trial, 2026-11-23).
- [ ] Check a failed avatar as the active one. (Returning from the game with the new **Main menu** button: checked 2026-11-24 with a new avatar, desktop and phone.) (Creating an avatar from an empty slot: checked 2026-11-23, the slot now glides into the big place first.)
- [x] Specialization in the overview's reserved space (D-056, 2026-11-23).

## Tutorial and first-journey tips — planned, 2026-11-23

Babuni: the game is sometimes hard to understand, so a new player should get a few tips here and there at the start of their journey.

- [x] A first in-game help: the "?" next to Equipment in the avatar card (D-057).
- [ ] Write the tutorial: which moments get a tip (first encounter, solution slots and sets, dice and the roll's math, rewards and losses, essences and Atranor, level-up choice, equipment), and their wording.
- [x] A "Tips and tutorial" check mark in the settings turns every "?" help off (D-059, 2026-11-23); new tips should use `HelpTip` or read the same setting.
- [ ] Decide how tips show and when they stop (once per player, a way to see them again).

## Player choices: equipment, specialization, edit, travel — concept, 2026-11-23 ([PLAYER_CHOICES.md](PLAYER_CHOICES.md))

- [x] Equipment rules written down: two items, +1 charge on equip, 1 charge back on a total of 12+, 2 on 20+, each use judged by its own roll, protected from Hardship and Misery, changeable (the extra charge leaves with the item), a broken item frees the slot.
- [x] Avatar selection modes written down: Equipment, Edit (paid with the portraits' and frames' gem values) and Specialization (+1 to rolls of one ability type). *(Replaced by the avatar overview, D-057 and D-058: equipment and specialization open from there.)*
- [x] Open questions settled and recorded as D-056.
- [x] Implement equipment: server rule and endpoint, equipment card in the avatar selection and the in-game avatar details, inventory picker; tests and a local check on desktop and phone.
- [x] One avatar card with the equipment slots, in the game and the avatar selection; only empty slots can be filled, at any time; the equipped item is preferred (D-057).
- [x] An animation when an equipped item regains a charge (2026-11-24, Babuni's idea): it sets off toward the encounter, turns halfway in a curve and flies back into the Inventory. Checked in the local game by starting the flight directly; not yet seen in a real round with a roll of 12 or more. Released 2026-11-24 in 0.9.0-beta.83.
- [x] Region travel written down: available regions cost gems and give the next encounter from there; locked regions are red and lead to the Expansions menu.
- [x] Implement specialization (2026-11-23): shared rule, server roll bonus and paid change, the overview's section and the picker in the main menu, one line in the game; tests and a local check on desktop and phone.
- [x] Warmth corrected (2026-11-24): type 25 is Aid and holds the Warmth skill; type 37 is no longer a specialization.
- [x] Implement edit avatar (2026-11-24): Edit under the portrait in the main menu's card; portrait of the same kind, frame, name; priced and charged on the server.
- [x] Implement region travel (2026-11-24): map highlights and red locked lands, the question, the Expansions menu for a locked land, `POST /room/travel` with host and guest rules.
- [x] Babuni confirmed travel (price, destinations, blocked during Atranor and level-ups) and added a wait: three encounters after a trip (2026-11-24, built).

## Atranor by the element's gods — 2026-11-23 (D-055)

- [x] Survival from a total of 7; one god's essence at 7, two at 14, three at 20; all three with an Atranor item or a gem sacrifice; one charge each. *(Two charges each from 2026-11-26, D-068.)*
- [x] Play it: a dice return at 7, 14 and 20, an Atranor item, and a gem sacrifice. *(Babuni play-tests every change; confirmed 2026-11-24.)*


## Soul Link, welcome gift and essences — 2026-11-26 (D-068)

- [x] New avatars start with six essence charges; Atranor returns two charges per god.
- [x] Share button for the Soul Link deep link; list of souls linked to you; today's progress toward the gift.
- [x] Aetherion as the newcomer's welcome gift on the gift day; 5 Alpha Player points for the inviter.
- [x] The expansion unlock card (LOCKED → UNLOCKED → read → Proceed) for every single-expansion unlock.
- [x] Alpha Player visible from the start with a "?" and the Legendborn places left.
- [x] The inviter's name on the sign-in screen when the game opens from a Soul Link.
- [x] The daily message pool (support, Soul Link), dashboard only.
- [ ] Not released yet; patch notes to be written at release.
- [ ] Not yet seen: a real phone's share menu, a gift day reached in real play, a homeland or Stripe purchase showing the card.
- [ ] Known limitation: Alpha Player progress is a read–modify–write without a row lock (as before); a level-up and a soul-link gift at the same moment could lose points.

## Server load: change signals instead of polling — 2026-11-27 (D-069)

- [x] No requests from a hidden tab; one refresh on return.
- [x] Achievements, help invitations and the Scribes feed refresh on `GET /player/changes` signals instead of every 5–10 s; duplicate dashboard fetches shared.
- [x] Released in 0.9.0-beta.87 (2026-11-27).
- [x] Bot adventurers stuck since the level-up change: fixed and put on shifts (D-071, 2026-11-27); production follows with the next release.
- [ ] Later, when many players are online at once: move the one change channel to SSE; with several API processes, PostgreSQL `LISTEN/NOTIFY` for the signals.

