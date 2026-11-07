# Morkahja — dynamic content publication design (proposal)

**Status:** Proposed / not implemented / not approved for production migration  
**Requested direction:** The human creative wants Babuni Admin to publish ordinary game content without application builds or deployments. The game server owns validation, authorization, storage, publication, and runtime integration.  
**Evidence:** Static inspection of babunidev/Morkahja main at 239cf21ed759cf12137e68ae41a85a0a26382fb9 on 2026-11-07. No live production, Nginx configuration, connected Babuni Admin code, tests, or player data were inspected.  
**Scope:** Encounters, solutions, expansions, frames, portraits, and their managed artwork. This document does not authorize production migration.

## 1. Current source-backed behavior

| Area | Observed code and consequence |
| --- | --- |
| Backend source | server/src/services/gameData.ts loads five JSON files from server/game and caches the parsed records in memory. Administrator save helpers directly rewrite files, then clear the corresponding cache. |
| Admin API | server/src/routes/adminRoutes.ts exposes GET/POST content endpoints behind ADMIN_API_KEY Bearer authentication at /game-data/admin. The controller performs only minimal key/ID checks. |
| Data integrity | The current saveJson uses synchronous direct file replacement. No atomic rename, staging, revision comparison, comprehensive schema/reference validation, image handling, or verified rollback is present in that code path. |
| Frontend imports | GameEnvironment and ExpansionsOverlay embed encounter data; ExpansionsOverlay embeds expansions; AvatarCreation embeds frames/portraits. SolutionStarfield, AvatarSolutionInflow, encounterInventoryPreview, SolutionBlock, ResultBlock, SolutionGridOverlay, and partyParticipantChoiceBadge embed solutions. The dev-only mockAvatar also imports frames/portraits. |
| Public assets | client/public/game contains JSON plus encounterimages and solutionimages; avatar portraits and frames are under client/public/UI/02_AvatarCreation. Built assets are deployed separately from server/game. |
| Startup and existing status | server/src/server.ts eagerly loads game data and exposes /game-data/status. client/src/api/http.ts uses this status endpoint but does not fetch an authoritative content bundle for rendering. |
| Active gameplay | server/src/types/encounter.ts copies encounter fields and precomputed rewards into persisted snapshots, but preparedEncounter stores only an ID and server gameplay can still consult the current solution map and encounter lookup. |
| Deployment | ecosystem.config.cjs starts the TypeScript server through PM2. The historical root DEVLOG describes copying client/dist into /var/www/morkahja with rsync --delete, which would not protect independently managed files placed inside that tree. |

Observed conventions to preserve: keyed encounter and solution objects, the expansions wrapper, frame and portrait indexed arrays with element 0 = null, existing field names including the established mEncounterSolutiuon spelling, numeric IDs and existing asset basenames.

## 2. Proposed minimum architecture

Keep JSON as the editable/published game-content format. **Do not add a second content database or make Babuni Admin's SSH view the authority.** Adapt gameData and the existing authenticated content routes around a single, server-owned, revisioned publication service.

- **Authoritative runtime root:** MORKAHJA_CONTENT_ROOT, provisioned outside the Git checkout and published webroot; initial proposed production location: /var/lib/morkahja/content. The path is configuration, not a hard-coded requirement.
- **Revisions:** revisions/<revision-id>/ contains the five original named JSON files and a manifest describing logical asset paths, content digests, publication metadata, and referenced immutable WebP blobs. Revisions are immutable; the current revision is selected by an atomically replaced pointer (for example current.json).
- **Asset store:** media/<sha256>.webp contains immutable bytes. The manifest maps existing logical paths/basenames (game/encounterimages, game/solutionimages, UI/02_AvatarCreation/Avatare, UI/02_AvatarCreation/Frames, and relevant expansion artwork) to blob hashes. Unchanged files are shared between revisions; do not duplicate all artwork per revision.
- **Bootstrapping:** repository copies remain a *read-only initial migration seed/development fixture*. In production, the server fails closed if the configured published root is missing or invalid; it must not silently fall back to Git-tracked content once migrated.
- **Publication:** an authorized server operation stages changes and assets, validates the complete candidate, builds an immutable revision, flushes it safely, and atomically swaps the current pointer. The API replies success only after the pointer is committed and the new revision is readable. On failure before the swap, the prior revision stays current.
- **Runtime:** gameData reads from the published revision and replaces the cached *whole bundle* as one immutable object. New encounters use the latest published revision without process restart. Requests already holding a revision keep it for that operation. If PM2 is ever configured with multiple workers, each must observe the active pointer (polling or equivalent) rather than relying only on in-process invalidation.
- **Frontend:** a same-origin, read-only endpoint serves the five datasets as one revision-consistent bundle. A shared client content store loads this bundle before relevant screens become usable; references formerly imported from JSON read from that store. Refresh on bootstrap, on returning to content-driven screens, and after a changed revision is observed. Avoid introducing a second persistent browser authority.
- **Deployment separation:** deploy code and static application assets from Git; never rsync --delete into the persistent content root. Nginx/Express expose published managed media read-only. The old public JSON copies cease to be runtime sources and must not be mistaken for canonical data.

This keeps one **published** authority, while allowing immutable historical revisions for recovery and existing sessions. A single primary record copy does not mean deleting the ability to restore an old revision.

## 3. API proposal (not the current contract)

Existing /game-data/admin endpoints are a migration target, not yet a safe write interface. Keep the same prefix and Bearer authentication, but introduce transaction-style publishing. All request/response shapes below are proposals for integration review.

| Method and path | Purpose / key contract |
| --- | --- |
| GET /game-data/content | Public complete content bundle: { revision, encounters, solutions, expansions, frames, portraits, assets }. Same revision for all categories; ETag and conditional requests; no admin token. |
| GET /game-data/admin/content | Admin view of current content and revision; protected. Can reuse the public payload with administration metadata. |
| POST /game-data/admin/content/validate | { baseRevision, changes, stagedAssetIds } → { valid, errors, warnings, baseRevision }; creates no publication. |
| POST /game-data/admin/assets/stage | Authenticated bounded binary WebP upload with explicit kind and basename; returns a short-lived opaque asset staging ID, detected MIME, dimensions, hash and logical destination. This route needs scoped binary parsing (the current global JSON limit is 32 KiB). |
| POST /game-data/admin/content/publish | { baseRevision, publicationId, changes, stagedAssetIds } → { ok, revision, previousRevision, publicationId, publishedAt }. Validates again under a publication lock, resolves staged media and commits atomically. |
| GET /game-data/admin/content/publications/:publicationId | Reports whether a publicationId committed, for reliable recovery when a network response is lost; protected. |
| POST /game-data/admin/content/rollback | Explicit { baseRevision, targetRevision, publicationId } → a new auditable publication selecting validated previous content; no silent destructive replacement. |
| GET /game-data/media/:revision/:kind/:filename | Proposed version-pinned, public WebP reader for managed artwork. The server must allow only known logical assets from the revision manifest and must not expose arbitrary filesystem paths. |

Define changes as typed upsert operations by category and record ID; do not let callers submit filesystem paths. Existing map/array shapes remain the output format. A single candidate revision may update records and assets together. Return 409 (REVISION_CONFLICT) if baseRevision differs from current at commit; 400/422 for malformed or invalid content; 401 for missing/invalid credentials; 503 when administration is not configured or storage is unhealthy. PublicationId enables idempotent retry and acknowledgement after uncertain connectivity.

The public bundle should support ETag/If-None-Match or an equivalent revision-based refresh mechanism. Never cache a published JSON response as immutable when it represents the *current* revision. Immutable revision-specific WebP URLs may be cached long-term; replacing an existing logical filename generates a new blob reference and a new revision URL. Old revision URLs remain available while pinned gameplay requires them. The logical WebP filenames and directory conventions stay stable even if the resolved serving URL becomes versioned.

**Authentication and limits:** Reuse the existing ADMIN_API_KEY only on the server/local operator backend, not in browser JavaScript or localStorage. Preserve TLS or a locally initiated SSH tunnel to reach the server. Harden token comparison, rate-limit and audit administrative operations, bound upload sizes and record counts, reject traversal/symlink destinations, and keep the server-side allowlist of content categories. Do not chmod production files to permit Babuni Admin SSH writes.

## 4. Validation and publishing invariants

1. Decode and validate every JSON document against explicit runtime schemas. Preserve existing field names and wrapper shapes; require finite numeric IDs/values, valid enums where established, reasonable text limits, and unique IDs. Reject key/embedded-ID mismatches, invalid references, duplicate canonical IDs, and prototype-path keys.
2. Preserve indexed frame/portrait element 0 as null. Validate numeric indices and reject sparse or unexpectedly huge arrays. Detect relations among encounter follow IDs, expansions, solution slots/reward pools, and assets, including new records referenced in the same pending revision.
3. Validate uploaded files as WebP (not merely the extension), with strict byte/dimension limits, a safe canonical basename, and collision rules. Reject conflicting logical filenames unless explicitly replacing the current asset; do not overwrite immutable blobs. Inventory and preserve existing assets before enabling deletion.
4. Detect current content that fails *new* validation as a migration blocker, not an excuse to silently modify original authored records. Produce a pre-migration discrepancy report and agree on any necessary corrections.
5. Serialize publication operations with one lock. Compare baseRevision within that critical section; stage complete data and media; verify hashes and parses; persist revision metadata; fsync or otherwise guarantee durability as appropriate for the filesystem; then swap the current pointer atomically. Re-read the published pointer and manifest before confirming success. A failure leaves previously published content readable.
6. Keep a revision audit (publicationId, revision hashes, timestamp, operator identity, changed categories, validation outcome), backups independent of the live host, and a tested restore procedure. Never store API keys, identities or player records with game content.
7. Never delete or silently repurpose an ID used by active encounters, inventories, profiles, purchases or achievements. Treat such edits as migration-sensitive. Deletion should be postponed until referential safeguards are implemented.

### Active encounter consistency

Persist contentRevision on newly generated solo and room encounter snapshots and carry it through prepared encounters. On resolution, read solution definitions, follow encounter references, and other mutable content using the snapshot's pinned revision, not the latest global map. Existing snapshots without contentRevision need a deliberate compatibility fallback to the migration baseline. Once a new encounter starts, it may take the latest published revision. Keep old revisions available while referenced. This is necessary because snapshotToEncounterData freezes many encounter fields today, but some other lookups remain live.

### Media compatibility

The existing encounter and solution logical paths and frame/portrait naming conventions are retained as *content identifiers*. Client image helpers should resolve these through the bundle's revision-aware asset mapping, including solution popups, SCRIBES activity images, preview cards and avatar creation. Legacy absolute URLs can remain available during client transition. Serve explicitly versioned URLs, not overwritten in-place files with indefinite browser caching. Review the actual Nginx configuration before choosing direct Nginx delivery versus controlled backend streaming/X-Accel-Redirect.

## 5. Reviewable implementation stages

| Stage | Work | Verification gate |
| --- | --- | --- |
| 0 — Architecture and audit | Document dependencies, choices and risks; inventory actual production files and current Nginx/deploy configuration without changing them. | Review and approve the proposed storage root, URL compatibility and migration plan. |
| 1 — Publication storage | Introduce configurable file-backed revision service and pure candidate validation; no live routes or migrations. | Unit tests for JSON shapes, reference checks, atomic failure, revision conflicts, restart loading, and rollback; test on temporary directories. |
| 2 — Admin contract | Protect stage/validate/publish/status/rollback routes; replace unsafe direct-write handlers, or disable them until safely adapted. | HTTP tests for auth, oversized/bad WebP, malformed payloads, concurrency, idempotency, failed writes and forbidden paths. |
| 3 — Runtime and client | Load current bundle through gameData; expose public bundle; replace all build-time JSON consumer imports, including background/UI helpers; pin snapshots to revisions. | Backend/client types and builds; simulated publish while an encounter and multiplayer room are active. |
| 4 — Persistent media and deployment | Route managed image categories through the persistent store; configure Nginx read-only media delivery, backup and code-only deploy. | New and replaced WebP visible without rebuild, cache refresh, old-version availability, rsync --delete safety and restoration drills. |
| 5 — Production cutover (separate approval) | Back up the live JSON/media/player DB, compare source hashes and asset inventory, import a baseline revision, deploy code, switch explicit configuration, and smoke-test. | Acceptance suite plus documented reverse cutover, no active-session damage and no unintended player-data migration. |

Do not delete old Git copies or rewrite old scripts before the new source and tests work. Convert scripts/verify-static-game-data.mjs from a three-copy identity assertion into fixture validation and candidate publication checks; adjust content migration scripts to work on an explicit unpublished fixture, never automatically on a production path.

## 6. Deployment, migration and rollback runbook (proposed)

**Before cutover:** Record exact commit and current server configuration; back up PostgreSQL separately; copy and hash all live JSON and relevant image trees; check free disk space, file ownership, image names, malformed records and existing references; take an off-host backup; inventory in-flight gameplay sessions. Verify Nginx rules that currently serve /game and /UI. Rehearse the procedure on a staging host using non-player data.

**Import:** Provision the persistent root with narrow permissions for the Morkahja process; import the verified JSON and managed media as an immutable baseline revision; validate against the current game; confirm published contents and media checksums. Do not use the existing Babuni Admin SSH user's filesystem access for writes.

**Cutover:** Deploy application code independently, configure MORKAHJA_CONTENT_ROOT and managed media delivery, then enable public bundle/runtime reads. Prefer a controlled transition with old clients still able to fetch legacy assets until compatibility is proven. Confirm encounter selection, UI previews, solution icons, portrait/frame selection, expansion unlocks and multiplayer with synthetic accounts.

**Content rollback:** If a publication is bad, select a previously verified revision through an authorized auditable rollback. Preserve the rejected revision for investigation; confirm clients receive the restored revision and compatible artwork.

**Application rollback:** A code rollback must be explicitly checked for compatibility with newer content schema/revisions. Keep a compatible old client/backend release and disable publishing while recovering; never implicitly overwrite the content root with older Git JSON. If required, return to the pre-cutover runtime only under the separately approved recovery plan.

**Backups and retention:** Keep immutable revision records, media blobs referenced by retained revisions, and independently restorable off-host backups. Define retention and retention-safe garbage collection only after active snapshot pinning and inventory references are covered.

## 7. Outstanding review items

- Babuni Admin's exact image collision/renaming behavior and upload limits were not verified; align the contract after inspecting that repository.
- The live Nginx site definition, PM2 process count, filesystem durability guarantees, production symlinks, backup tooling, and any post-Git deployment scripts were not inspected.
- Existing source JSON and all media files were not deeply validated against this *proposed* schema or manually inspected for orphan references.
- Server-side active-encounter lifetime and legacy snapshots require explicit compatibility tests before revision garbage collection.
- Current Stripe/pricing, achievement, reward, and inventory dependencies on mutable expansions/solutions require a focused audit before enabling destructive edits.
- The proposed content root, API route shapes and revisioned media URL are **design choices for review**, not evidence of already deployed functionality.

**Phase 1 repository audit:** [Content publication Phase 1 audit](CONTENT_PUBLICATION_PHASE1_AUDIT.md) includes tracked content and media inventory, Babuni Admin image naming/SSH review, a missing expansion-price field, and pending live verification.

**Verification status:** Repository source and documentation inspection only. No automated checks executed; no production files, active sessions, player data, or live services changed.
