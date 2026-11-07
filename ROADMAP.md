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

## Proposed — independent content administration (2026-11-07)

See [dynamic content publication design](docs/CONTENT_PUBLICATION.md). These tasks are proposals, not implemented features or accepted deployment decisions.

- [x] Inspect the repository's content loading, frontend JSON imports, admin routes, tracked game JSON/media and historical deployment documentation (static source review only; see [Phase 1 audit](docs/CONTENT_PUBLICATION_PHASE1_AUDIT.md)).
- [x] Draft a revisioned content architecture and staging/rollback procedure for review (documentation only).
- [ ] Approve and test the authoritative storage location and HTTP/media contract with Babuni Admin.
- [ ] Implement immutable content revisions, validation and transactional publishing with automated tests.
- [ ] Harden authenticated admin publishing and handle conflict/idempotent retry safely.
- [ ] Replace all runtime-relevant frontend JSON imports with one server-provided content bundle.
- [ ] Protect ongoing encounters and room snapshots with explicit content-revision pinning.
- [ ] Add managed WebP uploads, versioned delivery, cache refresh and tested rollback.
- [ ] Rehearse the deployment boundary, backups, migration and rollback before separately authorized production cutover.
