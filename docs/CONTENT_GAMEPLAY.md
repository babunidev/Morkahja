# Phase 7 — active gameplay content-revision protection

**Status:** Implemented in isolated draft [PR #15](https://github.com/babunidev/Morkahja/pull/15), stacked on unmerged draft PRs #10–14. [GitHub Actions run 42340188970](https://github.com/babunidev/Morkahja/actions/runs/42340188970) verified 5/5 new gameplay, 7/7 storage, 4/4 runtime, 6/6 admin, 4/4 artwork and 4/4 client tests (**26/26** focused checks), static data sync and the standalone frontend build. The complete release workflow still fails on eight pre-existing TypeScript errors in three unrelated server test files; no Phase 7 TypeScript errors appeared. No production deployment, database migration, publishing opt-in or modification of live player data.

## The consistency boundary

Content is selected **once** at the beginning of a new encounter or leader-created multiplayer room. Its immutable `contentRevision` is stored on the authoritative `EncounterSnapshot`, its prepared encounter and the `EncounterRoom` shell, as well as on each of the three pre-rolled participant slot snapshots. The room keeps this original revision across new encounters, follow-up selection, witnessed level-up/death system events, party joins/leaves and parked solo checkpoints. While a room exists, a new publication does not silently move any participant to different definitions. New independently created adventures select the latest published revision.

**Why a whole-room pin?** Prepared encounter IDs, precomputed rewards, participant choices, system-event lineage and checkpoint recovery all span multiple operations. Reading a new revision in the middle would produce a mixture of definitions with the same IDs. Requiring an explicit new-room boundary favors correctness over immediate exposure to newly published encounters.

The original `contentRevision` field is optional for backward compatibility, with `null` denoting pre-publication legacy content. New server snapshots always set the field. The prepared encounter's revision is matched to its containing snapshot. Room and active encounter revisions are checked for mismatch instead of silently selecting one.

## Historical data access

`getGameRuntimeContentSnapshotForRevision(revision)` in `server/src/services/gameData.ts` reads the exact historical, immutable revision directory and its verified five-category manifest. Pinned reads never use the latest pointer if it changes; a corrupted, missing or inaccessible pinned revision throws and blocks mutation.

For snapshots lacking a revision, the service intentionally reads the **bundled checked-in legacy baseline**, not whatever happens to be current in the external store. This is **not a generally safe automatic migration** for unknown prior deployments: operators must verify the actual old production JSON against that baseline before activating managed publication. In particular, if unpublished edits or an earlier experimental published mode already created untagged snapshots, those must be identified and migrated with explicit evidence or blocked from resuming. The service cannot reconstruct a vanished historical revision from an untagged record.

No automatic database scan, token migration, player-data rewrite or current-version fallback is performed.

## Encounter resolution and rewards

The deterministic solo and room resolver now reads `solutions` from the authoritative snapshot's revision. The same pinned table is passed through precomputed random rewards, level-up selection, type-15 essence rewards, Atranor survival and prosperity rolls, inventory grant quantities and failure/loss consumption. Result preparation records a fully calculated `preparedCommit` so a later publication cannot change amounts between reveal and continuation. Failed-avatar `preDeathSnapshot` retains the revision to support its original reward definitions during gem sacrifice and restoration.

Encounter metadata remains copied into each snapshot. Follow-up and prepared/system encounter IDs are resolved through the same historical encounter table as the earlier snapshot. The three pre-rolled room slots share one revision while retaining their independently prepared rolls and reward selections.

## Protect player-owned IDs

The publication validator already forbids deleting any previously published encounter, solution, expansion, portrait or frame ID. It now also forbids changing the gameplay identity of a retained ID, without querying personal player data:

- Encounter ID, type and expansion cannot be repurposed.
- Solution ID, inventory-container type and solution-type classification cannot be repurposed.
- Portrait ID, race, role, gender and portrait type stay the same.
- Frame ID, race, role and frame type stay the same.
- Expansion ID cannot be changed.

Text, icons, reward amounts, many encounter parameters and deliberate artwork replacements may still be revised; pinned adventures retain their historical definitions. A publication that reuses an old ID for a different semantic entity fails with `CONTENT_IDENTITY_CHANGE_NOT_SUPPORTED`. Whole-bundle relationship validation and the prohibition on deletion apply to both ordinary publication and rollback.

**Limit:** This is a global content invariant and does not inspect inventories or DB records to discover undocumented IDs from older data. No claims are made about real production inventory integrity until a privacy-preserving, read-only migration audit is completed.

## Verification and remaining work

`npm run test:content-gameplay` uses isolated temporary content roots and checked-in JSON to simulate a publication while a solo encounter and a three-slot multiplayer encounter remain active. It exercises old/new content lookups, pinned reward quantities, participant preparation through a fake transaction, system-event lineage, legacy snapshots, forbidden ID repurposing, and corrupted historical revisions. It does **not** create a real PostgreSQL-backed room, initiate networking, run a live multi-player session or query production.

The release workflow runs this suite after all previous focused content/client tests and before standalone client build and full typecheck. Record the results observed from GitHub Actions rather than inferring verification from test presence.

Release blockers remain: full root typecheck, complete server/database-backed encounter/room tests with publication racing active transactions, player-data inventory migration audit, legacy asset parity, real browser regression, operational backups and staged cutover. Production `MORKAHJA_ENABLE_CONTENT_PUBLISHING` remains disabled by default.

## Attribution

The human creative directed preservation of ongoing adventures and player-owned IDs during content updates. AI assistance implemented the revision-pinning approach, changes to the resolution and inventory paths, tests and technical documentation. This branch does not represent approval to migrate or deploy.

## Phase 8 recovery boundary (draft PR #16)

Content backups preserve all committed revisions required by pinned active encounters, including the historical artwork objects referenced by those manifests. A disaster restore must create a new content root containing the complete retained history; pruning old revisions would break active snapshots. Application rollback must leave the content pointer unchanged and use a code version that understands the current revision, media and snapshot metadata. This policy is documented but has not yet been exercised against a production backup or an older application release.
