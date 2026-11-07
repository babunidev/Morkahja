# Content publication — Phase 1 repository audit

**Date:** 2026-11-07  
**Status:** Repository review completed; production inspection, formal approval and contract adoption **pending**. No production changes are authorized by this report.  
**Evidence:** Morkahja `main` at `239cf21ed759cf12137e68ae41a85a0a26382fb9`; Babuni Admin `main` at `8d42562954ced85ee6f8d4bc9268415631ac2ee6`. Reviewed source through the GitHub connector and parsed tracked JSON and file-tree metadata. No live SSH, VPS, browser or DB access.  
**Companion design:** [Content publication proposal](CONTENT_PUBLICATION.md).

## Task results

| Phase 1 objective | Review status | Outcome |
| --- | --- | --- |
| Review PR #9 architecture | **Reviewed; approval pending** | File-backed immutable revisions, atomic pointer, publish API and client content store fit the current game, subject to active-session and production checks. Only the human creative can approve it. |
| Inspect actual Nginx, PM2, deployment, backups | **Partially inspected; live verification blocked** | Repository contains `ecosystem.config.cjs` and `.github/workflows/release-gates.yml`, but no tracked Nginx site configuration, actual PM2 status or verified backup schedule. Historical `DEVLOG.md` describes `rsync -a --delete client/dist/ /var/www/morkahja/` and PM2 restart. This is not proof of present production configuration. |
| Inspect Babuni Admin image naming, collision and SSH workflows | **Source review completed** | See observed workflows below. Remote publishing is not implemented. |
| Inventory JSON, references and media | **Repository baseline completed** | See counts and consistency below. Production file comparison pending. |
| Finalize location and API contract | **Review-ready proposal; operator approval pending** | Use configured persistent root, revisioned JSON/media, protected staging and commit endpoints. See contract below. |

## Morkahja repository content inventory

Five authoritative-seed JSON files currently exist at `server/game/`, with Git-tracked mirrors under both `client/src/data/game/` and `client/public/game/`. For **all five names** (encountersdata, solutiondata, expansiondata, frames, portraits), the three Git representations were byte-identical at the inspected commit. They are distinct source files, not a single filesystem source of truth.

| Dataset | Repository records | Shape / checks |
| --- | ---: | --- |
| `encountersdata.json` | 203 | Keyed map. No key/embedded ID mismatch or repeated numeric ID seen. |
| `solutiondata.json` | 247 | Keyed map. No key/embedded ID mismatch or repeated numeric ID seen. |
| `expansiondata.json` | 4 | `{ expansions: { ... } }` map. No key/embedded ID mismatch or repeated numeric ID seen. |
| `frames.json` | 99 | Indexed `Frames` array of length 100; element zero is null; no nonnull index/ID mismatch seen. |
| `portraits.json` | 681 | Indexed `Avatar` array of length 682; element zero is null; no nonnull index/ID mismatch seen. |

The following tracked Git media trees were counted, **without examining production contents**:

| Directory | Files | Approximate bytes |
| --- | ---: | ---: |
| `client/public/game/encounterimages/` | 237 | 43,568,170 |
| `client/public/game/solutionimages/` | 268 | 14,769,782 |
| `client/public/UI/02_AvatarCreation/Avatare/` | 686 | 39,126,960 |
| `client/public/UI/02_AvatarCreation/Frames/` | 100 | 5,049,666 |
| `client/public/UI/03_DASHBOARD/expansions/` | 4 | 989,570 |

**Basic reference checks:** All 202 unique encounter-image names referenced by 203 encounter records resolve to tracked WebP files; all 247 distinct solution icon names resolve; all 681 referenced portrait IDs and 99 frame IDs resolve. No dangling positive encounter-follow IDs, encounter-expansion IDs or primary solution-slot IDs were found. `help_heal_wounded_grimnir` is referenced by two encounters: sharing an image basename is valid, and publishing must not prohibit it.

The directory counts exceed current JSON references. **Do not delete unreferenced media during migration**: archived artwork, legacy paths or runtime references may still need it. This check does not establish deep WebP validity, image dimensions, record completeness, all runtime relations, production parity or zero duplicate JSON keys (JSON.parse does not detect duplicate lexical keys).

**Schema mismatch discovered:** All four `server/game/expansiondata.json` records contain `mExtensioPriceEurCents`, but `server/src/services/gameData.ts` and Babuni Admin's `src/features/morkahja/types/gameContent.ts` do not declare that property. The game client `ExpansionsOverlay.tsx` does declare it optionally. Preserve the numeric price field in schema, contract, editors and validation; check current editing flows for accidental loss before enabling writes.

## Current Morkahja integration boundaries

- `server/src/services/gameData.ts` loads and caches repository-relative JSON, with direct `writeFileSync` saves and per-category invalidation. There is no whole-bundle revision.
- `server/src/routes/adminRoutes.ts` exposes authenticated content GET/POST routes at `/game-data/admin/content/*`; the controller makes minimal structural checks only.
- `server/src/server.ts` eagerly loads JSON and exposes a count-only `/game-data/status`. Frontend modules embed all five data categories through build-time imports (including the encounter view, expansion overlay, creation UI, results, inventory and solution effects).
- Encounter snapshots already persist selected encounter fields and reward IDs, but prepared follow references and some solution-dependent resolution paths look up mutable definitions, so revision pinning is a production-safety requirement.
- Historical documentation describes Nginx serving `/var/www/morkahja` and PM2 running the game process. `ecosystem.config.cjs` exists; Nginx site config, live process count, timer jobs and off-host backups were not available through the repositories.

## Babuni Admin workflows reviewed

**Authority and deployment:** Root `AGENTS.md` and `docs/LOCAL_CONNECTION_MANAGER.md` require Babuni Admin UI and privileged local service to remain on the **operator's PC**, loopback-only. The game service independently authorizes remote actions. SSH/PostgreSQL currently provides constrained `ssh:preflight`, `ssh:probe` and `ssh:read` workflows, not content-publishing privileges; local-file inspection is read-only through its dedicated service. No generalized remote publishing adapter is implemented.

**Local editor / API:** `src/features/morkahja/services/contentApi.ts` reads `/local-content-api/*` in development local mode or the published `/game/*.json` otherwise. Existing remote record-save calls use a configurable API path, but remote image upload explicitly throws unless local mode is enabled. `vite.config.ts` has an opt-in development proxy that injects a server-side ADMIN_API_KEY; a future hardened local service should own production operator credentials rather than delivering secrets to browser JavaScript.

**Image conversion and collision:** `src/features/morkahja/utils/imageFileToWebpBase64.ts` preserves existing WebP or converts other browser-decodable images to WebP through canvas (quality 0.92). `vite/localContentPlugin.ts` checks RIFF/WEBP container markers and caps decoded uploads at 5 MiB; it has not been shown to validate every WebP dimension/codec edge case. Encounter image names are made from Unicode-normalized, ASCII lowercase underscore titles, capped at 80 characters. If a basename already exists, the code tries `2_`, `3_` etc, then a timestamp fallback. Explicit filenames and solution-image uploads can overwrite an existing logical name through `writeFileWithBackup` in `vite/atomicGameWrites.ts`. This helper writes a temporary file, fsyncs and renames it, preserving an optional backup; **it is not a multi-file or multi-revision publication transaction**.

**Required adaptation:** Keep the editor UX, JSON field names, WebP conversion, existing logical paths and disambiguation rule where safe. Replace direct file saves with authenticated staged media + validated whole-revision publication. The game server, not the Babuni Admin Vite middleware, chooses allowed asset destinations and commits the revision. Explicit replacement must be intentional and cache-busted.

## Proposed storage, client path and API contract

**Proposed** production storage: `MORKAHJA_CONTENT_ROOT=/var/lib/morkahja/content` (or another operator-approved persistent root outside Git and `/var/www/morkahja`). Code remains in Git; published data is never populated by routine `git pull` or `rsync --delete`. Initial Git JSON becomes a read-only seed/test fixture. Preserve existing WebP basenames and logical relative paths through an immutable-revision asset manifest.

**Proposed** API:
- Public `GET /game-data/content`: returns one revision-consistent bundle of `{ revision, encounters, solutions, expansions, frames, portraits, assets }`. ETag/If-None-Match supports refresh; endpoints for individual categories are optional read-side conveniences.
- Protected `GET /game-data/admin/content`: current revision and editable data.
- Protected `POST /game-data/admin/assets/stage`: bounded WebP with kind, safe basename and explicit replace intent; returns opaque staged asset token, hash and target logical basename.
- Protected `POST /game-data/admin/content/validate`: candidate changes and staged tokens plus `baseRevision` → cross-revision validation diagnostics, no publication.
- Protected `POST /game-data/admin/content/publish`: `baseRevision`, idempotent `publicationId`, typed changes and staged asset tokens → confirmed `revision` only after safe commit.
- Protected `GET /game-data/admin/content/publications/:publicationId`: status recovery if response is lost.
- Protected `POST /game-data/admin/content/rollback`: explicitly selected older revision and a new auditable publication record.
- Public managed-media URLs are **version-pinned** and limited to assets declared in that revision's manifest; final URL and Nginx routing are subject to real production configuration review.

For concurrent changes return `409 REVISION_CONFLICT`; reject malformed/invalid data and unapproved file targets before publication. Keep old image revisions available while referenced. Restrict administrative API access using protected operator credentials held by a local service and TLS or a user-initiated SSH tunnel, never by granting broad write access to the SSH user.

### Still required before operator approval or implementation

1. **Inspect live effective Nginx configuration** for `/game-data`, `/game`, `/UI`, caching, alias/root behavior and any backend proxy routing; review redacted output only.
2. **Inspect live PM2 process count/configuration and actual deployment scripts** without disclosing environment values (PM2 dumps may include secrets).
3. **Verify backups and restore:** server content, images, player PostgreSQL separately, off-host retention, and a rehearsal of recovery. No backup reliability claim can be made from the tracked repository.
4. **Inventory actual production JSON and images read-only**, compare hashes and missing-reference results against the Git baseline; do not assume Git matches the VPS.
5. **Decide** the persistent root, public media URL mapping, legacy client compatibility window and migration cutover procedure; approve the HTTP contract with Babuni Admin's developer.
6. **Review** expansion-price field preservation and authoritative legacy snapshot handling before any publishing writes.

**Verification:** GitHub file-tree and JSON parsing/reference comparisons were executed through the connected repository; no npm test or browser suite was run. No code, production content or live database was modified. The findings support a review-ready proposed architecture, not a release-ready system.
