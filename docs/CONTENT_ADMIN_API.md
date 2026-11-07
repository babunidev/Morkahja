# Morkahja — Phase 4 secure administration API

**Status:** Draft implementation in [PR #12](https://github.com/babunidev/Morkahja/pull/12), stacked on the unmerged Phase 3 PR #11 and Phase 2 PR #10. **No changes have been merged, deployed or enabled against live data.** Focused CI results and known limitations must be assessed before merge; this is not an authorization to enable live publishing.

## Authentication and request boundaries

The pre-existing server administrator key `ADMIN_API_KEY` remains the operator credential, sent as `Authorization: Bearer <key>` over HTTPS. There is no independent login system or per-operator identity. Key comparisons now use constant-time SHA-256 digest comparison rather than direct string equality, and missing configuration returns 503. Failed authentication returns 401, without logging authorization headers or secrets.

The `/game-data/admin` router is mounted **before** the player API JSON parser, so its authentication and request limits are applied independently: authenticated admin JSON bodies have a 256 KiB limit and a separate error handler; the player API retains its 32 KiB limit. Rate limits are 120 read and 20 mutation requests per minute per connection address, in memory per Node process, with 429 and `Retry-After`. Rate limits must also be configured on the TLS reverse proxy across worker processes; these checks do not substitute for that deployment review. Reject requests with oversized bodies rather than buffering an unrestricted upload.

Neither the key nor player identity information belongs in the content audit file. The current key design cannot distinguish between individual administrators: audit actor attribution is deliberately `admin-api-key`, not a fictitious named user.

## Published mode and safety switch

All revisioned content endpoints require an explicitly configured, existing external `MORKAHJA_CONTENT_ROOT`. If the root is unset, corrupt or missing, the administration API refuses to return Git fixture content or write a replacement copy.

**Publication and rollback are independently disabled by default.** `MORKAHJA_ENABLE_CONTENT_PUBLISHING=1` is required in addition to a valid root and admin authentication. Do **not** enable that flag in a live environment while active encounter/room snapshot revision pinning, media publication, backups and deployment verification remain incomplete. Record validation and inspection require no write flag.

The old direct-write routes are permanently disabled (HTTP 410) even without published mode:

`POST /game-data/admin/content/{encounters|solutions|expansions|frames|portraits}`

The repository's legacy handler code may still exist temporarily for compatibility/reference, but is no longer registered as a write endpoint. The new system never calls those direct save functions.

## Administrative routes

All paths below are relative to `/game-data/admin` and require the bearer key.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/content` | Current complete five-category publication, its revision and manifest. |
| GET | `/content/{encounters|solutions|expansions|frames|portraits}` | Original JSON shape for a category; includes `X-Content-Revision`. |
| GET | `/content/expansions/:id` | Existing expansion record by numeric ID. |
| GET | `/content/revisions` | Current revision ID and latest 100 historical manifest records. |
| GET | `/content/revisions/:revision` | Verified historical manifest and all five content categories. |
| GET | `/content/publications/:publicationId` | Manifest and current/historical state of a publication receipt. |
| POST | `/content/validate` | Check base revision, proposed edits, full schema and references. Does not publish. |
| POST | `/content/publish` | Same validation, then atomic publication and read-back confirmation. Requires explicit write flag. |
| POST | `/content/rollback` | Restore an older revision as a **new** audited revision, refusing destructive ID removal. Requires write flag. |
| POST | `/content/assets/stage` | 501: managed image upload is not implemented in Phase 4. |

All admin content read responses are `Cache-Control: no-store`. The public read endpoint `GET /game-data/content` remains separate, unauthenticated, and revision-consistent.

## Record creation and editing

The editor is stateless. An operator reads the current revision, prepares changes locally, validates them, and publishes the exact same edit request with a unique publication ID. There is no server-side mutable draft, direct record overwrite or repository file write.

Example validation request:

```json
{
  "baseRevision": "<current revision UUID>",
  "changes": [
    {
      "kind": "encounters",
      "key": "20001",
      "operation": "update",
      "data": { "mEncounterID": 20001, "...": "all existing required fields" }
    }
  ]
}
```

This example abbreviates the record. **Each `data` must be the entire record, not a partial-field patch.** `kind` is exactly one of `encounters`, `solutions`, `expansions`, `frames`, or `portraits`. `operation` is `create` or `update`. Each request supports 1–100 changes in the 256 KiB body limit. For frames and portraits, `key` equals their decimal array index; newly created high indices fill intervening slots with explicit `null`.

Publication adds `publicationId` to this request (8–100 alphanumeric, underscore or hyphen characters). Validation before publishing and validation inside the publish operation are both mandatory. Changes apply to a cloned, explicitly named base revision. Every candidate is checked against the full five-category schema, key-to-ID agreement, encounter follows, expansion/solution references, deletion prohibitions and required fields before it is written.

**Artwork references:** Until the managed WebP stage, a changed/new record may only reference image identifier values already present in the same image field in the base publication. This protects against dangling *new* names, but does **not** prove the corresponding legacy images exist on disk. No image bytes, MIME types, decoding or copyright information are validated; actual media publication requires a later stage.

No record deletion is supported. A stale `baseRevision` returns 409, except an exact idempotent retry of the still-current publication ID; the same ID with changed data returns 409. Publication writes the immutable revision plus current pointer via the existing store, rereads and verifies it, and returns the confirmed revision and manifest.

Rollback example:

```json
{
  "baseRevision": "<current revision UUID>",
  "targetRevision": "<older revision UUID>",
  "publicationId": "explicit_rollback_20261107"
}
```

This publishes the target content into a new revision. It refuses rollback that would delete IDs introduced since the target. It cannot undo external player/database operations, and a rollback must not be presented as a database restore.

Typical responses: `200` success; `400` malformed edit/request; `401` invalid key; `404` unknown publication/expansion; `409` revision or edit conflict, lock conflict or reused ID; `410` retired write; `413` oversized request; `422` invalid content or unavailable/new artwork identifier; `429` rate limited; `501` image upload not implemented; `503` missing configuration, disabled publishing or unreadable content. Responses omit filesystem locations and private credentials.

## Audit and acknowledgement

A private `admin-audit.jsonl` file in the external content root records timestamp, generic actor `admin-api-key`, action (`validate`, `publish`, `rollback`), attempt/success/rejection and a publication/revision ID when known. The file is appended and fsynced; publication manifests independently record their publication identifiers and checksums. Administrative audit writes must succeed before actual publication begins. The audit file is **not tamper-proof or backed up automatically**. It must be protected and backed up by the operating system alongside the revision store and monitored for growth; use off-host collection in a production rollout.

After commit, the API verifies the resulting current pointer before acknowledging. A lost HTTP acknowledgement can be recovered with `GET /content/publications/:publicationId`; repeating the same request with the same ID is safe only while that publication remains current.

## Verification and unresolved work

Run `npm run test:content-admin` from the repository root. HTTP tests use local loopback, temporary external roots and original Git-tracked JSON as test fixtures. They cover key/no-key authorization, permanent direct-write removal, all five categories, newly created records, validation, revision-based conflicts, idempotency, rollback, read-back receipts, body limits and anonymous audit entries. Verify results from the actual CI run rather than assuming tests passed from their presence in the repository.

Production blockers remain: real admin client integration, independent TLS/proxy access review, content-root permissions and backups, managed WebP uploads and asset existence checks, current active/room snapshot revision pinning, and completion of the existing TypeScript/release-gate failures. Deployment, client cutover and configuration changes were not part of this PR.
