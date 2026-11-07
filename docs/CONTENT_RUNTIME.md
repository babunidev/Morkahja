# Morkahja — Phase 3 backend runtime integration

**Status:** Implemented and tested in [draft PR #11](https://github.com/babunidev/Morkahja/pull/11), stacked on the unmerged Phase 2 storage PR #10. Source commit `8758546b` passed **7/7 storage** and **4/4 runtime HTTP** tests on [GitHub Actions run 42332861255](https://github.com/babunidev/Morkahja/actions/runs/42332861255), including a newly added encounter ID and updated solution. **The complete release workflow failed** on existing TypeScript errors in `encounterResolver.test.ts`, `pendingLevelUpRewards.test.ts`, `roomService.ts`, and `solutionConsumption.test.ts`, outside this change. This is not a deployed release, production migration or Babuni Admin publishing integration.

## Runtime authority and activation

Only an explicit, existing `MORKAHJA_CONTENT_ROOT` outside the repository and webroot enables the published content store. With this variable unset, the existing backend still loads the Git-tracked game JSON; no automatic content migration occurs. If it is set but the directory, pointer, manifest or content is invalid, the process or request **fails closed** rather than reading Git fixtures.

`server/src/services/gameData.ts` now exposes:

- `getPublishedContentSnapshot()`: returns the currently selected immutable publication object `{revision, manifest, content}`, or `null` **only** when no root is configured. It reads the pointer once and verifies the manifest selected by that exact pointer. The cache key includes root, revision and manifest SHA-256.
- `getGameRuntimeContentSnapshot()`: captures one typed set of encounters, solutions (numeric-ID lookup), frame/portrait records and expansion records. The returned snapshot remains stable if a subsequent request observes a newer publication. If publication is disabled, the snapshot uses the existing repository-backed getters.
- Existing `getEncounters()`, `getSolutionMap()`, `getFramesData()`, `getPortraitsData()`, `getExpansions()` and their lookup helpers keep their existing signatures and observe new revisions on their next access. The old direct-save functions reject writes while published mode is enabled.

`server/src/services/contentPublication.ts` now supports reading a **caller-selected** pointer. This removes a race between reading `current.json` and loading the selected revision when a second process swaps the pointer. A published revision contains all five datasets, so one operation can hold a stable reference to the full set even after publication.

## New encounter generation

`createEncounter` captures one runtime snapshot after its asynchronous player/active-encounter/unlock lookups, then uses that same snapshot for selecting the encounter, determining the prepared random encounter and looking up regular encounter reward/essence candidates. Follow-encounter selection now honors an explicitly passed encounter map instead of silently querying the latest global map. Subsequent new encounter creations observe new revision IDs without restarting the Node process.

**Boundary:** This does not yet persist a `contentRevision` on active/room snapshots. Existing encounters being resolved still use live solution and follow-encounter lookups in some code paths. Room follow-up, legacy snapshot compatibility, every reward path and cross-await gameplay consistency require the later **active encounter revision-pinning** stage before enabling live publishing. No claim is made that ongoing gameplay is safe against all schema changes yet.

## Public HTTP content contract

`GET /game-data/content` is mounted **before player session authentication** and is strictly read-only. Its successful response returns:

```json
{
  "revision": "<published revision UUID>",
  "encounters": {"00001": {"mEncounterID": 1}},
  "solutions": {"10001": {"mSolutionID": 10001}},
  "expansions": {"expansions": {}},
  "frames": {"Frames": [null]},
  "portraits": {"Avatar": [null]},
  "assets": {}
}
```

The content objects in this example are abbreviated; real responses contain all existing fields. `assets` is reserved and empty until the WebP publication stage. The endpoint never exposes a configured filesystem path, revision manifest history, admin tokens, player records or server internals.

| Response | Meaning |
| --- | --- |
| `200` | A complete validated publication, plus quoted `ETag` set to its revision. |
| `304` | `If-None-Match` matches the current published revision; no response body. |
| `503 CONTENT_NOT_CONFIGURED` | `MORKAHJA_CONTENT_ROOT` is unset. No Git fallback on this endpoint. |
| `503 CONTENT_UNAVAILABLE` | Configured publication is invalid, missing or unreadable. No JSON or filesystem-path leak. |

`Cache-Control: no-cache` requires revalidation of the current pointer. This endpoint must **not** be stored as immutable by a proxy/CDN. Browser clients can read the exposed `ETag`; CORS allows `If-None-Match` for conditional retrieval. Immutable, revision-specific media URLs remain a later task, and the old frontend still imports game JSON at build time.

The legacy `/game-data/status` endpoint now reports counts from one runtime snapshot, plus `revision` (null when using the legacy Git datasets). It does not force published-mode activation.

## Verification and safety gates

The new `npm run test:content-runtime` suite uses a loopback Express server, isolated temporary roots and the real checked-in JSON datasets. It tests no-root 503, read-only semantics, complete five-category response, ETag/304, new encounter/solution records on the next fetch, preservation of already captured snapshots, selected-pointer race behavior, and invalid-pointer failure without repository fallback. CI runs this suite after Phase 2 storage tests and before the existing typecheck and database-dependent suites.

**No production checks:** No Nginx/PM2, backup files, live endpoints, active players, database operations or deployments were changed or queried. Approval and the separate media/client/snapshot compatibility stages remain required before any production activation.


## Phase 5 addendum (draft PR #13)

The earlier description of an empty assets object describes Phase 3 alone. The stacked Phase 5 implementation adds managed image URL maps to the public content response and a revision-specific public WebP route. Existing browser assets are not migrated automatically. See [managed artwork](CONTENT_ARTWORK.md).
