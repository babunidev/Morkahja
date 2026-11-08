# Morkahja — changelog

**Author:** Babuni.dev

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

## 2026-11-07 — Opt-in content revision storage (review branch)

- Added an internal, validated JSON publication service with immutable revision directories, checksums, atomic current-pointer changes, revision conflicts, publication history and explicit restoration.
- Added optional runtime content-root loading in `gameData.ts` with legacy direct writes disabled when published mode is configured, while preserving current default data loading pending a reviewed migration.
- Preserved expansion price in the server TypeScript interface, added storage regression tests and included them in the release workflow.
- No Babuni Admin publishing API, dynamic frontend, artwork publishing or production migration is part of this change. Test and deployment status are independent of source changes.

## 2026-11-07 — Backend content runtime integration (draft PR #11)

- Added a coherent published-content snapshot API, with selected-pointer reading and cache refresh on revision changes.
- Updated new solo encounter creation to select encounter, prepared encounter and regular rewards from one runtime content snapshot.
- Exposed public read-only `GET /game-data/content` with ETag revalidation and safe 503 responses when published content is missing or invalid.
- Made `/game-data/status` count a single coherent snapshot and report its revision.
- Added isolated HTTP/runtime regression tests, CI wiring and explicit documentation of the pending media/client/active-session migration.
- Production behavior remains unchanged until the opt-in content root and remaining stages are separately approved and deployed.

## 2026-11-07 — Secure revisioned content administration (draft PR #12)

- Reused and hardened bearer API-key authentication with constant-time digest comparison; introduced admin-specific JSON body caps and read/write request throttling.
- Added authenticated revision/status reads and stateless create/update operations for encounters, solutions, expansions, frames and portraits.
- Added validated atomic publishing, conflict/idempotency rules, publication confirmation and explicit non-destructive rollback through the existing revision store.
- Added private durable administrative audit records and conservative image-reference checks; managed WebP asset staging remains unavailable.
- Disabled the five older unsafe direct-write endpoints even with legacy content mode enabled.
- Registered focused HTTP security/publication tests in release CI; production configuration and live player data were not modified.

## 2026-11-07 — Managed WebP artwork (draft PR #13)

- Implemented authenticated, bounded WebP staging with filename, structure, dimensions, base-revision and explicit create/replace intent validation.
- Added private SHA-256-addressed image objects under the external content root and optional revision-manifest artwork mappings.
- Validated new JSON artwork references and portrait/frame IDs against staged managed assets; published JSON and managed-image references via one atomic pointer.
- Added versioned public WebP URLs with immutable caching and hash-based ETags, preserving historical image bytes across replacements and rollback.
- Extended storage, runtime and admin regression checks with focused artwork HTTP and failure-injection tests.
- Original static artwork and browser components are unchanged. No live media migration, production opt-in or deployment occurred.

## 2026-11-07 — Dynamic client content (draft PR #14)

- Added one client-wide, revision-consistent content cache, server revalidation with ETag and atomic five-dataset snapshot updates.
- Moved encounter, expansion, solution, frame and portrait lookups from per-component build-time JSON imports to the shared content store.
- Routed managed artwork through revision-aware URLs across encounter art, inventory/solution UI, results, party badges, transitions and avatar visuals.
- Preserved explicit legacy-configuration compatibility while rejecting corrupt, incomplete or unexpected server content without partial publication.
- Added bootstrap/screen-entry refresh, periodic revalidation, focused client regression tests and a standalone frontend build CI gate.
- No production content, VPS, player records or current main branch were changed.

## 2026-11-07 — Active gameplay content-revision protection (draft PR #15)

- Persisted an immutable content revision on new encounter snapshots, prepared follow-ups, all multiplayer room slots and their room shell, solo checkpoints, and pre-death snapshots.
- Migrated solo and room encounter selection, action resolution and reward/inventory calculations to read the snapshot's exact historical encounter and solution definitions.
- Added checked-in baseline compatibility for untagged pre-publication snapshots and fail-closed handling when explicitly pinned history is unavailable.
- Strengthened publication and admin validation against deletions and semantic repurposing of established content IDs, independently of personal player data.
- Added isolated tests that publish new content while simulated solo/multiplayer snapshots remain active, including historical lookup, reward behavior, legacy compatibility and corrupt history.
- No player/database migration, live publishing, frontend historical presentation pinning or production deployment was performed.

## 2026-11-07 — Deployment and content recovery (draft PR #16)

- Added deployment preflight checks that reject overlap between the Git checkout, persistent content root, static web root and off-host backup destination.
- Added an application-only deployment runner that backs up published content before Git pull, scopes rsync deletion to the dedicated frontend web root, runs release gates and reloads PM2; it never publishes content.
- Added versioned content backup verification and restore-to-new-root commands, preserving all committed JSON revisions, referenced WebP objects and the administrative audit log.
- Added an Nginx proxy include for revision-aware media URLs and documented independent application/content rollback procedures.
- Added focused backup/restore and deployment-isolation tests to the release workflow. No live host, Nginx, PM2, content root, backup mount or player data was changed.


## 2026-11-08 — Automated migration verification (draft PR #16)

- Expanded static JSON parity checks to encounters, solutions, expansions, frames and portraits across all three checked-in runtime/fallback copies.
- Corrected invalid test fixture reward values and completed required encounter fields so server typechecking can enforce the declared contracts.
- Added a temporary-root migration rehearsal covering baseline import, live revision refresh, historical snapshot reads and rollback as a new revision.
- Added isolated PostgreSQL to GitHub Actions and registered room lifecycle and pending level-up persistence tests.
- Restricted the deployment runner's release check to static validation, typechecking and the frontend build; database-mutating tests run only against disposable CI PostgreSQL.
- Documented automated coverage and the production migration boundary. No production backup, host migration, Nginx change, player-data rewrite or production cutover was performed.


- Added an explicit `content:initialize` command: dry-run validation, empty-root/path separation checks, mounted off-host legacy JSON backup with SHA-256 verification, and initial revision publication only after the backup passes.
