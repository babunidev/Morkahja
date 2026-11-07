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
