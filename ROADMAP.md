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

## Phase 2 — independent content storage (implementation review, 2026-11-07)

- [x] Implement a configurable, opt-in authoritative content root outside Git and the public webroot, with fail-closed reads when explicitly enabled.
- [x] Preserve the five JSON data shapes, IDs, author fields and indexed null-zero arrays in published revisions.
- [x] Implement immutable revision directories, a current pointer, SHA-256 checksums, validation and an exclusive publication lock.
- [x] Add revision conflict handling, publication IDs, audit metadata, pre-pointer failure safety and rollback-as-new-revision.
- [x] Add a focused temporary-directory regression suite and register it in release CI (CI results must be verified separately).
- [x] Verify 7/7 focused content publication tests and current JSON fixture import on GitHub Actions run `42331816271`.
- [ ] Obtain review/approval and pass the complete release gates (existing TypeScript errors and database-dependent CI remain blockers).
- [ ] Implement protected admin publishing, revision-aware media and client runtime content loading in subsequent stages.
- [ ] Verify live Nginx, PM2, backup configuration and production content parity before any independent deployment or live migration.

Implementation details: [Phase 2 storage](docs/CONTENT_STORAGE.md). None of these checked items represents a deployed production change.

## Phase 3 — backend runtime integration (draft PR #11, 2026-11-07)

- [x] Adapt the Phase 2 storage-backed `gameData.ts` to capture one published runtime snapshot.
- [x] Atomically select/cache a validated revision and observe pointer updates without a Node restart.
- [x] Use one captured revision when selecting new solo encounters and regular rewards; updated solution records and new encounter IDs appear on later reads.
- [x] Add read-only, revision-consistent `GET /game-data/content` with ETag/304 and no-cache semantics.
- [x] Add selected-pointer consistency and generic 503 failure handling for missing/invalid published roots.
- [x] Verify 7/7 storage and 4/4 temporary-directory HTTP runtime tests (including newly published encounter IDs) against real repository JSON on [CI run 42332861255](https://github.com/babunidev/Morkahja/actions/runs/42332861255).
- [ ] Review and merge the stacked backend PRs when authorized; full release CI remains blocked by existing TypeScript errors outside these changes.
- [ ] Pin active encounters and room resolution to their content revision before live publication.
- [ ] Add authenticated publishing, managed WebP, frontend dynamic content and a reviewed production migration.

See [runtime integration](docs/CONTENT_RUNTIME.md). Checked work describes a draft branch, **not** deployed behavior.

## Phase 4 — secure administration API (draft PR #12, 2026-11-07)

- [x] Reuse the existing administrator API key and harden comparison; return 401/503 on invalid or missing credentials.
- [x] Expose authenticated five-category content reads, revision history and publication receipt status.
- [x] Support atomic creation and editing in all five categories via stateless, base-revision-checked record changes.
- [x] Validate complete candidate bundles, required schema fields, ID keys, cross-record relationships and existing image identifiers.
- [x] Add explicit validate-before-publish route, with independent validation again at publication.
- [x] Return revision conflicts and reject reused publication IDs with different content; allow exact current-publication retries.
- [x] Confirm published pointers, preserve revision history and support explicit non-destructive rollback.
- [x] Retire five unsafe legacy per-record write POSTs with HTTP 410, regardless of legacy content-loading mode.
- [x] Add bounded admin JSON bodies (256 KiB), single-process rate limits and private fsynced audit events.
- [x] Verify **6/6 Phase 4 admin HTTP tests** plus 7/7 storage and 4/4 runtime tests on [CI run 42334602021](https://github.com/babunidev/Morkahja/actions/runs/42334602021). The full release gate still fails on nine unrelated pre-existing TypeScript errors.
- [ ] Complete a passing full release workflow; baseline TypeScript errors outside content integration remain.
- [ ] Add managed WebP upload/asset-existence validation; asset staging currently returns HTTP 501.
- [ ] Complete active/room content pinning and operational TLS/proxy, backups and security review before enabling writes in production.
- [ ] Review/merge PRs #10, #11 and #12 in dependency order, then integrate the separately maintained local admin UI.

Detailed API, security assumptions and limitations: [Phase 4 administration](docs/CONTENT_ADMIN_API.md). All checked code is a **draft-branch implementation**, not an active production service.

## Phase 5 — artwork management (draft PR #13, 2026-11-07)

- [x] Add authenticated raw-WebP upload staging, bound to a base revision and the existing opt-in publishing flag.
- [x] Validate RIFF/WebP structure, file size, dimensions, safe names, category and create/replace intent; full pixel decoding is not yet implemented.
- [x] Preserve encounter, solution, expansion, portrait and frame logical naming conventions.
- [x] Reject image-name collisions without explicit replacement; keep historical image objects on replacement.
- [x] Write staged assets as immutable, SHA-256-addressed objects outside the repository and deployed webroot.
- [x] Require staged assets for new JSON image references and newly created portrait/frame IDs; publish artwork mapping and JSON through one revision pointer.
- [x] Serve managed WebP assets by revision-specific URLs with ETags and immutable cache headers.
- [x] Add isolated HTTP and failure-injection regression tests (CI results documented in PR #13).
- [ ] Migrate and verify existing production legacy artwork and image references; existing legacy files are not automatically checked.
- [x] Implement a draft browser runtime resolver for managed media URLs (Phase 6, not deployed).
- [ ] Integrate the separate local Babuni Admin UI with the publishing API.
- [ ] Add production-grade full WebP decode validation, storage retention, quotas, off-host media backup and operational proxy/security review.
- [ ] Pin active multiplayer/solo encounters to content revisions and pass full release checks before enabling live publishing.

Details: [Phase 5 artwork](docs/CONTENT_ARTWORK.md). A checked task is an isolated draft-branch implementation, not production deployment.

## Phase 6 — frontend dynamic content (draft PR #14, 2026-11-07)

- [x] Add one React-subscribed content store backed by the revision-aware public content API, with ETag/304 and concurrent refresh deduplication.
- [x] Migrate encounter and expansion JSON lookup away from per-screen build-time imports.
- [x] Migrate solution icon, inventory, result/reward/loss, solution grid, party badge and avatar-transition lookups to the shared revision.
- [x] Migrate AvatarCreation's portrait/frame lists, avatar stack rendering and preloads to shared content and image helpers.
- [x] Prefer revision-aware managed WebP URLs while preserving known legacy artwork paths during explicit compatibility mode.
- [x] Revalidate content on boot, dashboard/game entry, encounter changes and relevant overlay entry; poll when dashboard/game is active.
- [x] Keep last complete content on fetch/validation failure; permit bundled legacy content only after explicit backend CONTENT_NOT_CONFIGURED.
- [x] Verify 4/4 dynamic client tests, 21/21 preceding focused tests, static JSON sync and the separate frontend production build on [CI run 42337063166](https://github.com/babunidev/Morkahja/actions/runs/42337063166). Overall release still fails at the nine existing server TypeScript errors.
- [x] Implement draft server-side encounter and room revision pinning in Phase 7; real DB-backed and frontend pinned-view verification remain required before production live publishing.
- [ ] Verify browser/device gameplay, server API migration, artwork parity and local Babuni Admin integration in staging.
- [ ] Resolve existing server TypeScript errors, pass full release gates, review and merge stacked PRs in dependency order.

See [Phase 6 client content](docs/CONTENT_CLIENT.md). This work is in a draft branch, not deployed.

## Phase 7 — protect ongoing gameplay (draft PR #15, 2026-11-07)

- [x] Add optional contentRevision metadata to persistent encounter, prepared encounter, room, all three room slots, solo checkpoints and pre-death snapshots.
- [x] Resolve active and prepared encounters from the exact immutable historical revision rather than the newest published JSON.
- [x] Feed pinned solution definitions through deterministic resolution, reward generation, level-up/Atranor, inventory routing and penalty/grant calculations.
- [x] Preserve room revision across system events, waiting/advance boundaries and participant reseeding.
- [x] Support old untagged snapshots against the checked-in legacy baseline without silently assigning the current published revision; requires pre-cutover production parity verification.
- [x] Forbid deletion and gameplay-identity repurposing of previously published encounter, solution, expansion, portrait and frame IDs; reject during admin validation and publication.
- [x] Verify publication-during-gameplay simulations: 5/5 new tests, 30/30 total focused tests, static JSON sync and standalone frontend build on [CI run 42340188970](https://github.com/babunidev/Morkahja/actions/runs/42340188970); full server typecheck still fails on eight pre-existing test-file errors.
- [ ] Exercise real PostgreSQL-backed solo/party lifecycle, concurrent publication during transactions, reconnect, death/sacrifice and historical artwork in a staging environment.
- [ ] Reconcile client active-game presentations with server-pinned historical content (the Phase 6 browser store still follows the newest revision).
- [ ] Audit live legacy snapshots and inventory IDs before any production migration; do not enable live publishing until cutover checks and full release gates pass.

Details: [Phase 7 gameplay revisions](docs/CONTENT_GAMEPLAY.md). Draft implementation is not a deployed or approved feature.

## Phase 8 — deployment and recovery (draft PR #16, 2026-11-07)

- [x] Separate the application-only deployment workflow from content publication; the runner never calls admin publish or changes the content pointer.
- [x] Add preflight guards requiring distinct external application, persistent content, static web and backup roots, a marked dedicated web root and a mounted backup destination before Git pull or rsync.
- [x] Scope rsync --delete-delay to the marked dedicated client web root, preserving /.well-known/ and the marker; verify the reloaded API health before sync and never target content or backup roots.
- [x] Add versioned content backups with file inventory, SHA-256 verification, all committed historical JSON revisions, referenced artwork objects and admin audit history.
- [x] Block backup during an active publication lock; restore only into a new, non-existing content root and verify it before returning.
- [x] Add an Nginx media proxy include that preserves revision-aware API cache headers without exposing the private content directory.
- [x] Document application rollback separately from content rollback and define the compatibility checks required for old application versions.
- [x] Verify 4/4 backup/restore and 6/6 deployment-isolation tests; all 40 focused content/deployment tests, static-data verification and the standalone frontend build passed on [CI run 42342330337](https://github.com/babunidev/Morkahja/actions/runs/42342330337). The complete release gate still fails on eight pre-existing TypeScript errors in three server test files.
- [ ] Provision a real off-host backup mount, encryption, retention and scheduled backup operation; rehearse a complete restore.
- [ ] Integrate the Nginx include on the actual HTTPS host, run nginx -t, reload, and verify current/historical media requests and headers.
- [ ] Pass the complete release gate, test the exact application rollback target against a restored content copy, and approve a staged production cutover.

Details: [Deployment and recovery](docs/DEPLOYMENT_RECOVERY.md). The deployment runner is guarded but has not been run against a production host. The Phase 8 branch and all preceding content stages remain draft review work.
