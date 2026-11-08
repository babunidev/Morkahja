# Morkahja — Phase 9 automated testing and migration readiness

**Status:** Automated regression coverage and an isolated migration/reversal rehearsal are implemented in draft PR #16. The work is not deployed. Production content parity, a real staging-host rehearsal and the separately approved production cutover remain outstanding.

## Automated verification map

| Area | Test coverage |
| --- | --- |
| Static data parity | `verify:static-data` compares all five datasets across `server/game`, `client/src/data/game` and `client/public/game`. |
| JSON schema and cross-references | `test:content-publication` validates the checked-in five-dataset baseline, record keys, required fields, indexed arrays, follow links, expansion links and solution links. |
| Failed writes and concurrency | Publication tests inject a failure before the pointer swap, verify the previous revision remains current, enforce the exclusive lock and reject stale writers. |
| Retries and rollback | Publication tests verify exact idempotent retries and rollback as a new immutable revision. |
| Authentication and upload safety | Admin and artwork HTTP tests cover bearer authentication, bounded requests, unsafe asset names, invalid WebP payloads, stale stages and rejected publication. |
| Five-category updates without a rebuild | Admin tests edit encounters, solutions, expansions, portraits and frames; client-store tests replace the complete five-category snapshot without a Vite rebuild. |
| Artwork replacement and cache behavior | Artwork tests verify immutable revision URLs, ETag/304 behavior and historical image bytes after replacement; client tests verify atomic URL changes. |
| Snapshot compatibility | Gameplay revision tests cover legacy untagged snapshots, pinned solo and room revisions, historical lookups and publication during a prepared encounter. |
| Backup and recovery | Backup tests verify historical JSON revisions, referenced managed artwork, audit history, checksums and restore into a new root. |
| Deployment isolation | Deployment tests reject overlapping roots, symlinks, an unmarked web root and an unmounted backup destination. |
| Database-backed room behavior | CI runs session authentication and pending level-up persistence against disposable PostgreSQL. The broader room lifecycle suite remains manually runnable; its host/guest departure transition needs stabilization before CI inclusion. |
| Initial legacy import | `content:initialize` validates the five legacy datasets, writes a checksum-verified pre-import JSON backup to a mounted backup filesystem, then publishes the initial revision into an empty external content root. |

Run the focused suites from the repository root:

```bash
npm run verify:static-data
npm run test:content-publication
npm run test:content-runtime
npm run test:content-admin
npm run test:content-artwork
npm run test:client-content
npm run test:content-gameplay
npm run test:content-backup
npm run test:content-migration
npm run test:deployment
npm run test:pending-level-up
npm run release:check
```

The database-backed commands require a disposable, non-production PostgreSQL database. Never point these tests at the production database: they create test sessions, players, avatars and rooms. The broader `npm run test:rooms` suite remains available for manual room-service work but is excluded from release CI until its host/guest departure transition is deterministic.

## Isolated migration and reversal rehearsal

The publication regression suite now performs one combined rehearsal using the actual five JSON files checked into `server/game`:

1. Read the legacy five-category bundle without modifying its source files.
2. Publish it as the initial revision in a temporary content root.
3. Capture the runtime snapshot and publish a revised encounter record.
4. Verify the runtime observes the new revision without a process restart while the captured and explicitly pinned historical snapshots retain their original title.
5. Restore the initial content as a new rollback revision.
6. Verify the updated historical revision remains readable and all original source files remain byte-for-byte unchanged.

The backup suite separately creates and verifies a versioned backup, then restores it into a fresh temporary root. These tests rehearse filesystem behavior and revision semantics; they are not evidence of a real staging host, production backup mount, Nginx configuration or live database migration.

## Migration boundary and production prerequisites

No production host or production content directory was available to this implementation. Therefore:

- No production JSON or legacy artwork was backed up, hashed or compared.
- No claim is made that production content matches the checked-in legacy baseline.
- No real off-host backup mount, retention policy or PostgreSQL backup was exercised.
- No staging deployment, browser/device acceptance test or Nginx request was performed.
- `MORKAHJA_ENABLE_CONTENT_PUBLISHING` remains disabled by default; no production environment variable was changed.

Before a staging rehearsal, an operator must take a read-only snapshot of the actual five production datasets and the deployed legacy artwork, calculate and retain hashes, compare IDs and references against the candidate baseline, and preserve that snapshot independently of the application server. Use a non-production content root and a disposable or privacy-scrubbed database. Verify that the application, content, web and backup roots are separate and that the backup destination is a real off-host mount. Do not copy player/account records into a content migration.

The initial external content root must be provisioned explicitly and be empty. The operator-facing `content:initialize` command now provides a read-only dry-run and an explicit apply path. It validates the five JSON datasets and all cross-references, requires separate source/content/backup roots, requires the backup root to be a mounted filesystem, writes a versioned legacy JSON backup with SHA-256 checksums, verifies that backup, and only then publishes the initial content revision. If publication fails, the verified backup is retained.

Example staging dry-run:

```bash
MORKAHJA_CONTENT_ROOT=/var/lib/morkahja/content \
MORKAHJA_CONTENT_BACKUP_ROOT=/mnt/morkahja-backups \
npm run content:initialize -- --environment staging \
  --source /srv/morkahja/legacy-game \
  --publication-id staging_initial_20261108
```

After reviewing the dry-run inventory and confirming that the backup root is the intended off-host mount, the staging apply command adds `--apply --confirm-off-host-backup`. A production apply additionally requires `--environment production --confirm-production-cutover`; that approval and command have not been issued. The initializer backs up the five JSON datasets only. Legacy static artwork and PostgreSQL player data require their own independently verified backups; the initializer does not copy or modify either. It does not deploy the application, alter Nginx, restart services or enable admin publishing.

## Production cutover acceptance

Production cutover is a separate approval, not part of this draft implementation. It must not proceed until:

- The actual production content and artwork snapshot is backed up off-host and independently verified.
- A staging migration and reversal have succeeded using the same application commit and content format intended for production.
- The exact deployed Nginx include passes `nginx -t`, and current/historical media requests return the expected content type, ETag and immutable cache headers.
- The real PostgreSQL backup and restore procedure is verified independently of the content backup.
- New encounters, changed solutions, expansions, portraits and frames are visible in the browser without rebuilding.
- Replaced artwork receives a new revision URL while historical snapshots and images remain readable.
- Existing solo and multiplayer snapshots retain their original `contentRevision`; newly created adventures use the selected current revision.
- Content rollback and application rollback are tested independently, and the exact application rollback target understands the current manifest, artwork and snapshot formats.
- The operator explicitly approves the production cutover and acceptance window.

Until then, keep the existing production source and player data untouched, leave publishing disabled, and treat all new content infrastructure as draft review work.
