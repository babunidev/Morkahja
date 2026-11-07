# Morkahja — Phase 2 content revision storage

**Status:** Implemented and validated in isolated review branch; not deployed, not enabled by default and not a complete Babuni Admin publishing interface. GitHub Actions on source commit `34ed798d` reported **7/7 new content-publication tests passing**, including current `gameData` revision refresh and blocked legacy mutation. The overall release workflow did **not** pass: pre-existing TypeScript errors in encounter test fixtures, pending-level-up tests and `roomService.ts` prevented the full typecheck/client build (run `42331816271`). Earlier runs also failed on the existing session-auth check when CI PostgreSQL was unavailable. These are independent release blockers, not a verified complete build.

## Storage authority

`server/src/services/contentPublication.ts` implements a file-backed content revision store without adding a database or replacing the existing JSON shapes:

```text
<configured MORKAHJA_CONTENT_ROOT>/
  current.json                         # atomically replaced pointer
  revisions/
    <uuid>/
      manifest.json                    # publication ID, previous revision, hashes, timestamp
      encountersdata.json
      solutiondata.json
      expansiondata.json
      frames.json
      portraits.json
    .<uuid>.stage/                     # incomplete candidate, never current
  .publication.lock                   # exclusive publication lock, never authoritative data
```

The `current.json` pointer contains a revision ID and the SHA-256 hash of its manifest. Each manifest records the SHA-256 hash and byte length of all five datasets, its previous revision, publication ID, creation timestamp and operation (`initial`, `publish` or `rollback`). Revisions are never overwritten. The bundle preserves the same JSON key formats, field spellings, expansion wrapper and frame/portrait arrays (including a null entry at index zero). Additional authored fields, including `mExtensioPriceEurCents`, are retained.

The server does not create the root or import initial content automatically. The operator must provision the directory, back up and compare the real production files and execute an approved explicit migration later. The proposed production root from the architecture design is `/var/lib/morkahja/content`; it is **not** hardcoded or claimed to exist.

`server/src/services/gameData.ts` reads the published bundle only when `MORKAHJA_CONTENT_ROOT` is explicitly set to an existing absolute directory outside the Git checkout and published webroot. It checks the current revision pointer and refreshes its whole cached bundle when the revision changes, without process restart. Missing/invalid published content fails closed rather than silently using repository data. Direct legacy admin writes throw `CONTENT_PUBLISH_REQUIRED` in this mode. Without this environment variable, the old repository JSON loading and legacy development write behavior remain unchanged so this PR does not require a production cutover.

**Important limitation:** The browser still imports Git JSON at build time. The new storage API is an internal server library, not an authenticated publishing endpoint or a public content API. Switching the backend to this store on production before completing the later runtime/client/media stages is **not authorized**.

## Publication operation

`publishContentRevision(root, { baseRevision, publicationId, content })` is synchronous and deliberately not wired to HTTP. It:

1. Requires an existing safe root and acquires an exclusive `open(..., 'wx')` lock. A left-behind lock after a crash requires inspected/manual recovery, not automatic lock stealing.
2. Checks the currently published base revision, the idempotency publication ID and all five JSON shapes. It rejects mismatched map keys/IDs, missing required fields, missing follow/expansion/solution references, invalid indexed arrays and any removal of a previously published ID.
3. Serializes the validated candidate into a unique staging directory, writes each file with fsync and its SHA-256 digest, and writes/flushes a manifest.
4. Renames the candidate directory to an immutable revision and rereads it to verify all checksums.
5. Atomically renames a flushed temporary `current.json` into place, flushes the root directory and confirms the pointer. No visible pointer is changed before validation and revision preparation finish.

If publication fails before the pointer swap, the last published revision remains readable. An orphan prepared revision may remain, with its publication ID reserved. If the process crashes during or after pointer replacement, recovery must determine the actual current revision; filesystem atomic rename means the pointer refers either to the previous complete revision or the fully prepared new one. Off-host backups remain a separate production task; content revisions are not backups of the database or artwork.

A concurrent or stale request is rejected with `CONTENT_PUBLICATION_LOCKED` or `CONTENT_REVISION_CONFLICT`. A duplicate ID returns the existing result only while that publication remains the current revision; a reused older ID is rejected to avoid falsely reporting a later publication as current. The operation is intended to be invoked only from a future protected, validated admin service.

`readPublishedContent(root)`, `readContentRevision(root, revision)`, `readContentPointer(root)` and `listContentRevisions(root)` support historical inspection and read-back checks. `restoreContentRevision(root, baseRevision, targetRevision, publicationId)` creates a **new** audited revision from old data. It refuses rollback that would remove IDs added since the target; a recovery plan for new IDs and live references must be reviewed separately.

## What is and is not validated

Implemented checks cover key-to-record IDs, mandatory primitive fields, finite nonnegative integers, expected five wrappers, indexed frame/portrait arrays, encounter follow IDs, expansion IDs and primary solution IDs. Existing special encounter types (including 66/77) and difficulty 1–7 are retained rather than narrowed by outdated TypeScript enumerations. Unrecognized additional authored fields are preserved.

Not yet covered: media existence, WebP validation, complete business rules/semantic ranges, payout and pricing consistency, active snapshots pinned to revisions, existing player ID dependencies, database backup/restoration, and cross-file atomic artwork publication. No deletion or destructive ID reuse is supported.

## Development tests and review gates

`npm run test:content-publication` exercises temporary-directory publication, reload, checksum detection, revision locking, stale-writer conflicts, bad references, failed pointer swaps and explicit restoration. The release CI workflow now includes these checks and the existing TypeScript/client build. Report passing results only from actual executions.

Required before any live activation: inspect Nginx, PM2 and backup configuration; compare production content and artwork with the repository baseline; rehearse the import in staging; add protected admin endpoints and revision-aware media; migrate all client imports; pin active gameplay; document a separately approved production cutover and rollback. This Phase 2 implementation alone does not meet the full Babuni Admin integration acceptance criteria.
