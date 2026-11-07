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
