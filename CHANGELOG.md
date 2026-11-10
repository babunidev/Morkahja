# Morkahja — changelog

**Author:** Babuni.dev

## 2026-11-10 — Test fix: random failures in `systemEventInventory.test.ts`

- The level-up scenario in `server/src/services/systemEventInventory.test.ts` failed at random because it checked exact essence and spell counts while the encounters it used still granted randomly drawn rewards. A level-up's rewards are drawn when the encounter is created, from its own roll; a Prosperity draw can include an essence (seen in CI as 10 essence uses instead of 6). The normal encounter's random rewards could be an essence or spell 10001 itself (seen locally as 7 essence uses and as 3 charges of 10001 instead of 0).
- The test now gives that normal encounter no random rewards and removes essences from the pre-drawn level-up rewards. All assertions are unchanged. Game code is unchanged; granting an essence on a Prosperity level-up is existing behavior.
- **Verification:** the test passed 60 of 60 consecutive local runs (an earlier, partial fix failed 1 in 25). `NODE_OPTIONS=--throw-deprecation npm run release:check` passed (9 client, 38 server tests). Nobara, local Podman PostgreSQL.

## 2026-11-10 — One stream: all open work merged into `main`

- `main` now contains PR #18 (one copy of the game content, `ee960792`), PR #19 (serve the game from `/Morkahja/` plus the stalled-turn fix, `1d35f4a9`) and PR #20 (documentation readability, `a2a3ac2f`). The merged `feat/babuni-dev-subpath` branch was deleted. No other branches or pull requests remain open; the local `backup/main-before-cleanup` branch holds only June admin encounter edits that are already in `main`.
- **Not deployed:** production still runs backend `95fd5c5a` and frontend hotfix `0d217fc7`, which predate #18. The next release must upgrade backend and frontend together (see `docs/DEPLOYMENT.md`).
- **Verification:** `NODE_OPTIONS=--throw-deprecation npm run release:check` passed on `main` at `1d35f4a9` (Nobara, local Podman PostgreSQL); details in `docs/DEVLOG.md`. No application code changed in this step.

## 2026-11-10 — Deployed: serve the game from /Morkahja/ (branch `feat/babuni-dev-subpath`)

- **Subpath build:** `client/vite.config.ts` sets `base: '/Morkahja/'` for production builds and `vite preview` (override: `VITE_BASE_PATH`). Production `VITE_API_BASE_URL` defaults to `/Morkahja/api`. `vite preview` proxies that prefix to the local backend with the prefix stripped. Development still serves from `/`.
- **Asset URLs:** Added `client/src/assetUrl.ts`. All hard-coded `/UI/…` and `/game/…` paths in client source (about 40 files), dice art from `shared/src/diceCatalog.ts`, and server-provided feed and achievement icon paths now resolve beneath the deployed base. Server responses are unchanged.
- **PWA and social preview:** `client/public/manifest.webmanifest` uses relative `start_url`, `scope` and icon paths, which resolve to `/Morkahja/`. `client/socialPreview.ts` falls back to `https://www.babuni.dev/Morkahja` and points `og:image` at the existing `posterRaceSkills2.webp`; the previous `.png` reference had been returning 404.
- **Backend behind a proxy:** `server/src/config/trustProxy.ts` sets Express `trust proxy` (default `loopback`, override `TRUST_PROXY`). Without it, all players behind Nginx would share one per-IP rate-limit bucket for session challenge, bootstrap and heartbeat.
- **Deployment:** Added `deploy/nginx/morkahja-locations.conf.template` and rewrote `docs/DEPLOYMENT.md` with the discovered public infrastructure, environment variables, procedure, rollback and security assessment.
- **Tests:** Added `client/src/assetUrl.test.ts` (base handling, manifest scope, regression guard for unwrapped asset paths) and `server/src/config/trustProxy.test.ts`.
- **Verification:** `NODE_OPTIONS=--throw-deprecation npm run release:check` passed locally on Nobara against a disposable PostgreSQL 16 container. A local Nginx + headless Chrome run verified routing, assets, onboarding, logout, deep links, recovery-key restoration of the same player, and a committed encounter turn through `/Morkahja/api/`. Not yet merged into `main` at the time; merged later on 2026-11-10 as PR #19.
- **Fix: turns stalled after choosing a solution or dice (`0d217fc7`, hotfix deployed 2026-11-10):** Since #17 the server withholds encounter rolls until a choice is committed, but the client committed only once it knew the roll, so the choice was never sent and Continue stayed disabled. `SolutionBlock` now marks its reveal call as the commit phase (`client/src/ui/game/blocks/actionRevealPhase.ts`, with a unit test), and the existing server-resolution effect reveals the returned roll. Babuni reported the stall in production after the upgrade. The fix was verified by real UI clicks locally and live (solution, dice and a level-up system event) and deployed as a frontend-only release.
- **Deployed (2026-11-10):** Released to production at `https://www.babuni.dev/Morkahja/` from commit `95fd5c5a`, with Babuni's approval. The backend was upgraded from `77062a42` at the same time. The database backup was verified by restore, and live checks passed; see `docs/DEPLOYMENT.md`. Still open at the time: Stripe webhook URL, a real pre-migration account restore, and merging into `main` (all three were completed later on 2026-11-10; see `ROADMAP.md`).
- **Target host (2026-11-10):** At Babuni's decision the production address is `https://www.babuni.dev/Morkahja/`. The social-preview fallback, test URLs, Nginx template comments and deployment configuration were updated to match. No runtime path logic changed.

## 2026-11-10 — Documentation readability

- Moved the dated audit, test, pull request and gameplay status notes out of the front page into `docs/RELEASE_STATUS_HISTORY.md` and rewrote the entry as a game and project guide. No application, database or production changes.

## 2026-11-10 — Unreleased: one copy of the game content

- `server/game/*.json` is now the only copy of encounters, solutions, expansions, frames and portraits. The duplicate copies in `client/src/data/game` and `client/public/game` were removed; images stay in `client/public/game`.
- New public endpoint `GET /game-data/content` serves all content in one response with an ETag (`Cache-Control: no-cache`), so a returning browser gets `304 Not Modified` when nothing changed. The client loads it during the loading screen instead of building the JSON into the app; the main JavaScript bundle shrank from about 948 KB to 511 KB.
- The server re-reads a content file when its modification time changes (checked at most once per second) and keeps the last good copy if a file is invalid. Admin saves are written atomically. Content edits therefore reach players on their next page load, without a rebuild or restart. Running rooms keep their own encounter snapshots.
- `npm run verify:static-data` now checks the single source: structure, matching ids, references from encounters to solutions, follow-ups and expansions, image files, and that no client copy has been reintroduced.
- babuni.admin writes the JSON to `server/game` (separate change in that repository).
- **Verification:** see `docs/DEVLOG.md` (2026-11-10). **Not deployed.** Merged into `main` as PR #18 (`ee960792`) on 2026-11-10; still not deployed as of the consolidation entry above.

## 2026-11-04 — Unreleased: authentication, persistence and release-gate maintenance (PRs #5 and #6)

- **PR #5** (`security/one-time-session-challenges`): Added short-lived, single-use server-issued authentication challenges, bound to identity, device and registration/restoration purpose, with PostgreSQL-backed consumption and dual signatures. Updated client onboarding/recovery and authentication integration fixtures. **Open; not merged or deployed.**
- **PR #6** (`fix/atomic-player-avatar-writes`, based on PR #5): Replaced application-side read–merge–write in player/avatar document setters with PostgreSQL JSONB atomic UPSERT merges; serialized session lifecycle, daily encounter counters, reward-claim metadata, avatar/profile writes, purchases' unlocked-expansion initialization, friends and Wall of Fame operations where modified; added parallel persistence test coverage. **Open; not merged or deployed.**
- Added `npm run test:persistence --prefix server` to the server scripts and CI release gates. No gameplay or user-data migration was performed by this documentation change.
- **Verification:** Authentication and persistence tests passed on a separate Nobara/Podman PostgreSQL test worktree. GitHub Actions passed static-data verification, authentication/persistence, achievements, dice, and client build. Earlier CI failed on TypeScript errors; later PR #6 CI runs passed the complete typecheck.
- Corrected pre-existing server TypeScript diagnostics in encounter/solution test fixtures, typed progression test reads and the solo checkpoint type import. No gameplay-rule change. **GitHub Actions release-gates run #69 passed completely** at commit `c9a1c311` (static data, session auth, persistence concurrency, achievements, dice, client build, and typecheck).
- Corrected a room regression test that expected a late-joining guest to choose during the host's system event; the implemented state is `witnessing` for non-actors. Added the room regression suite to CI. **Verified:** GitHub Actions run #82 passed all steps, including `test:rooms`, at commit `d191729f`. Gameplay runtime behavior was unchanged.
- Corrected the solo-room rejoin test to count persisted `adventure_started` events for its own player and avatar instead of counting entries in the capped, mixed-visibility Scribes feed. Reused development databases can change the feed's visible event-type totals without changing the number persisted for one player. No gameplay behavior changed. **Verified in GitHub Actions release-gates run #84** (all steps passed at `feee2913`, including the room tests); Nobara integration rerun against the existing populated PostgreSQL database passed `roomService.test.ts`, `soloRoomCheckpointService.test.ts`, and `avatarDeathService.test.ts` on 4 November; the deprecation warning remains.
- Repaired three existing test entrypoints after the Nobara integrated-source run: the optional JSON encounter fixture now has an in-memory deterministic fallback; the lifecycle smoke test checks immediate next-encounter persistence rather than removed `clearEncounter` behavior and uses unique test IDs; client visible-reward tests run under the project's TypeScript aliases. Added all three to CI; gameplay runtime behavior is unchanged. **Verified in GitHub Actions run #87, attempt 2**, including the three new checks. Attempt 1 failed an intermittent pre-existing room-state assertion at `roomService.test.ts:1214`; the retry passed without a code change. Local integrated-source rerun remains pending.
- Isolated the intermittent guest-departure/rejoin test under a dedicated host avatar, removing interference from prior synthetic rooms that shared the original avatar and tied on `updatedAt`. Preserved the host advancement assertion, added room/focus/choice checks, and repeated the full room suite three times per CI run. Converted the encounter engine's transaction-client reads from overlapping `Promise.all` calls to sequential awaits without changing game rules, schema or room lookup. **Verified:** GitHub Actions runs [#93](https://github.com/babunidev/Morkahja/actions/runs/41884012574) and [#94](https://github.com/babunidev/Morkahja/actions/runs/41884344700) passed completely; room suite passed three times per run, and #94 additionally passed room and lifecycle checks with deprecations treated as errors. The PostgreSQL overlapping-query warning did not appear in either run. **Additional Nobara verification:** After merging the PR #6 update into `integration/priority-1`, the developer ran three room suites and the lifecycle test under `NODE_OPTIONS=--throw-deprecation`, plus the persistence suite and `release:check`; all passed without the overlapping-query warning. The placeholder-avatar diagnostic and non-blocking Vite size warning remain, and deployment has not occurred.
- **Priority 2 — Stripe fulfillment:** A signed, paid Checkout Session now claims its session ID and event ID, records the purchase, and applies the full entitlement bundle within one PostgreSQL transaction. Duplicate events and separate event IDs referring to the same session do not grant twice; a failure rolls back all grants and is retryable. Recognizes asynchronous payment success and recovers a legacy event claim lacking a purchase record. Added failure/retry/concurrency and cross-session replay tests. **Verified in CI run #105** with atomic rollback, replay and concurrent session fulfillment checks; no live Stripe payment was charged.
- **Priority 2 — Fate confidentiality:** Room and legacy encounter HTTP responses no longer transmit pre-rolled dice or reward IDs before the local player has a resolved choice. Other participants' unrevealed actions/results are also hidden from the viewer; system-event actor reward pools appear only after the actor rolls. **CI run #105 passed the redaction assertions.** The server retains its authoritative snapshot; the animation's browser presentation requires manual acceptance.
- **Priority 2 — Lore gems:** Server enforces the stored claimable-at timestamp, serializes room activation, and awards each player's lore gem under the same transaction as the room commit, with a player-specific claim key preventing duplicate currency grants. Preserved the existing shared-room gem semantics. **CI run #105 passed the early/parallel claim tests.**
- **Priority 2 — Concurrent joins:** Slot selection, room membership checks, and insertion now use a row-locked transaction; slot configuration, reengagement, room-offer seeding, and selected departure updates no longer overwrite a newer participant list. Added a parallel three-guest/two-slot regression test. **CI run #105 passed the concurrent-join checks.** **Nobara integrated automated retest (4 November):** Stripe commerce tests, room/lore security suite, encounter lifecycle, persistence and complete release check all passed. No overlapping PostgreSQL query warning was emitted. Cross-room same-player concurrency, actual signed Stripe test-mode webhook delivery and browser reveal animations are still unverified.
- **Observed but unchanged:** One browser session opened in multiple tabs can play different avatars. Its current behavior is intentionally retained pending later feature design and independent multi-avatar stress testing.


## 2026-10-26 — documentation foundation

- Added central concept, roadmap, agent rules, architecture, decisions and AI attribution documentation from the actual repository structure.
- Preserved the long original `DEVLOG.md` unchanged as primary historical evidence.
- No application code, secrets or runtime deployment was changed in this pass.

Historical change details are in [DEVLOG.md](DEVLOG.md); do not reinterpret all entries as tested releases.

## 2026-10-27 — Documentation consolidation audit #30

- Expanded the concept, roadmap, README, architecture, decision history, collaboration method and derived development-history guide from the original dated root journal.
- Added missing `docs/DESIGN.md` and `docs/CONTENT.md` to document visual evolution and content provenance.
- Preserved the original `DEVLOG.md`, application code, game assets, contributor credits and historical notes unchanged.
- Static documentation inspection only; no new browser, server, release or production test was executed.

## 2026-10-31 — Publication preparation

Recorded Babuni.dev’s direction to publish the actual project after review and retire its separate documentation edition afterwards. Confirmed the existing standard document structure; added `docs/PUBLISHING.md`. No runtime or visibility changes.

## 2026-10-31 — Changed: publication decision record

- Recorded Babuni.dev’s open-development decision and verified current visibility in Decisions and Development journal; retained licensing, media-rights and deployment distinctions.


## 2026-11-09 — Proposed babuni.dev subpath deployment plan

- Added `docs/DEPLOYMENT.md` for the proposed `https://babuni.dev/Morkahja/` game address, including hosting alternatives, Vite/API/static-asset routing, PWA and Stripe settings, player recovery, verification and rollback.
- Added the target and uncompleted work to the roadmap and recorded the human-selected address in the decision history.
- Linked the deployment plan from the README and recorded the documentation work in the development guide.
- Static source inspection and documentation changes only. No application code, DNS, server, production database or Stripe settings were changed; no build or deployment test was run.

## Unreleased — 2026-11-04 — Achievement milestones

- Stopped treating the first nonzero progress point as a Scribes achievement unlock; actual rank increases now trigger client notifications.
- Separated started achievement chains from earned avatar titles and Hearth Blessing bonuses. Daily payout now has one base gem plus the bonuses from achieved ranks.
- Realigned Firestarter/Pathfinder milestones: one avatar starts visible progress, two avatars earn Firestarter, three earn Pathfinder, followed by 15 and 30 combined levels.
- Firestarter ranks are never lowered: a rank earned under the earlier milestones is kept, while new rank-ups follow the revised ones. Legacy rank-4 decoding is retained and stale unlock timestamps are corrected.
- Added threshold, reward, title and Scribes notification regression tests; all 11 achievement tests passed in GitHub Actions run 41766029656. Overall CI remained blocked by an existing unavailable PostgreSQL endpoint in the session-auth test; no gameplay deployment is claimed.
