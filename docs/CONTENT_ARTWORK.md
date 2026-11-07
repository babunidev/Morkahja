# Morkahja — Phase 5 managed artwork

**Status:** Isolated draft [PR #13](https://github.com/babunidev/Morkahja/pull/13), stacked on unmerged Phases 2–4 (PRs #10–12). Not deployed or enabled on the production server. Test results and unresolved release gates are recorded in the pull request.

## Existing artwork conventions

Existing JSON keys and names are preserved. Encounter images use mEncounterImageName and legacy /game/encounterimages/NAME.webp. Solution icons use mSolutionIconName and /game/solutionimages/NAME.webp. Expansion fields use mExtensioCollectionImage, mExtensioHeaderImage and mExtensioUnlockButton. Portraits use avatar_ID.webp from /UI/02_AvatarCreation/Avatare and frames use frame_ID.webp from /UI/02_AvatarCreation/Frames.

Images managed by this feature use the *same logical names*, but reside under the separately provisioned external MORKAHJA_CONTENT_ROOT. No production artwork is copied or altered automatically. Existing browser paths still refer to the old static artwork until client migration is implemented.

## Storage model and atomicity

Inside the content root:

    current.json                        atomic current revision pointer
    revisions/UUID/manifest.json        JSON hashes and managed image mappings
    artwork/objects/SHA256.webp         immutable, content-addressed binary
    artwork/staged/UUID.json            private staged-upload descriptor
    admin-audit.jsonl                   private admin operation record

The revision manifest optionally includes assets by kind and logical name. Each entry records SHA-256, bytes, width and height. Old Phase 2 manifests without assets still load. Publication first verifies staged files and writes the five JSON files plus the complete asset map into a durable revision directory; the only visibility change is the final atomic current-pointer swap. Staged image objects can remain unreferenced after a failed publication, but cannot be publicly requested without a revision manifest. Replacements create new hashes rather than changing existing files. Historical revision URLs remain resolvable; rollback republishes the target JSON and asset mappings as a new revision and still blocks destructive record ID removals.

## Authenticated upload and staging

POST /game-data/admin/content/assets/stage requires the existing admin bearer key, an externally configured content root, and the explicit MORKAHJA_ENABLE_CONTENT_PUBLISHING=1 flag. The body is raw WebP bytes (not JSON or multipart), Content-Type: image/webp. Required headers:

    X-Asset-Kind: encounters
    X-Asset-Name: new_scene.webp
    X-Asset-Intent: create
    X-Asset-Base-Revision: UUID

Kinds are encounters, solutions, expansions, portraits and frames. Names allow only ASCII letters, numbers, underscores or hyphens, optionally followed by .webp. Portraits must follow avatar_ID and frames frame_ID with a positive integer ID. Filenames with path separators, traversal, unsafe extensions and mismatched category names are rejected.

The 4 MiB request limit is enforced before staging. The server validates RIFF/WebP size and chunk layout, still-image VP8, VP8L and VP8X headers, and image dimensions (1–4096 pixels per side and at most 16,777,216 pixels). Animation is rejected. **This is structural file validation, not full pixel decoding, transcoding, virus scanning or a rights audit.** Those additional protections remain operational review work before accepting untrusted production uploads.

Create intent refuses a name already used by current JSON or its managed artwork. Replace intent requires a name already in use. This includes replacing an existing *legacy* image without overwriting its original static file. The stage is bound to its base revision and recorded privately; only a successful publish makes it publicly addressable.

The successful 201 response includes stageId, kind, name, intent, baseRevision, dimensions, byte count and hash. Publication does not accept the raw bytes again.

## Publishing related JSON and WebP

The existing validation and publish requests accept assetStages as an optional array of at most 32 staged UUIDs alongside baseRevision, publicationId and the complete-record changes array. An artwork-only replacement may use changes: [] only when assetStages is nonempty.

Validation checks stage metadata and its immutable bytes, base-revision match, creation/replacement intent, all existing schema/relation checks and every newly introduced image reference in candidate JSON. New encounter/solution/expansion image names, and newly created portrait or frame IDs, require matching managed image entries in that same revision. Existing unchanged legacy identifiers remain permitted for compatibility, but their physical legacy files have not been verified or migrated. This is the documented remaining limitation on broken references during rollout.

Both validation and publication check the linked assets. Publication IDs remain idempotent only for identical JSON *and* stage IDs. Stale/reused IDs or stale artwork stages cannot silently overwrite the current revision. Failed validation or a simulated crash before pointer swap preserves the prior current revision. All artwork objects are stored outside Git checkout and public webroot, and managed objects are checked by digest when read.

## Public image serving

GET /game-data/content now returns an assets map of managed logical names and revision-aware URLs, for example:

    /game-data/media/REVISION_UUID/encounters/new_scene.webp
    /game-data/media/REVISION_UUID/portraits/avatar_682.webp

The public GET /game-data/media/:revision/:kind/:filename route serves only hashes named in a verified revision manifest. Valid images return Content-Type: image/webp, ETag based on content SHA-256 and Cache-Control: public, max-age=31536000, immutable. Matching If-None-Match returns 304. Unknown image names return 404. Corrupt/unavailable content or storage returns a generic 503 without a filesystem path or legacy fallback.

A replacement gives the logical name a **new revision URL**. Old revision URLs continue returning their original bytes. A consuming frontend must use these URLs rather than hardcoded legacy paths to see live updates; that client change is not part of this Phase 5 PR.

## Verification, known limitations and release gates

Run npm run test:content-artwork from the repository root, along with the previously established content-publication, content-runtime, content-admin and static-data checks. Tests use a temporary external content root, real WebP samples, the checked-in JSON baseline, authenticated loopback HTTP and publication failure injection; they do not access production.

Still unimplemented or unverified: full WebP decoder verification of all pixel payloads; live Nginx request limits and filesystem permission review; stage retention/cleanup and object garbage collection; off-host media backups; complete legacy artwork inventory/import and existence checks; active encounter and multiplayer revision pinning; frontend dynamic media loading; real Babuni Admin integration; and successful full project TypeScript/release verification. No production activation is authorized by this isolated implementation.

## Phase 6 browser addendum (draft PR #14)

The statement above that the browser still uses exclusively static art describes the Phase 5 branch in isolation. Phase 6 now provides a client-wide revision-aware resolver that prefers published managed image URLs and falls back to the original static asset URL only for known legacy identifiers. Avatar creation, portrait/frame composition, encounter imagery, expansion art and solution/reward displays use the resolver. Real production asset migration/parity and browser device verification remain separate.

## Phase 8 media delivery addendum (draft PR #16)

The repository now includes deploy/nginx/content-media-location.conf, a proxy location for the immutable /game-data/media/ endpoint. It preserves the API's WebP content type, ETag and revision-specific immutable cache headers without exposing the private content root. No live Nginx site file was available, so this snippet has not been installed or syntax-tested on the production host. Versioned content backups retain every artwork object referenced by committed historical revisions; pending upload stages are intentionally excluded and must be uploaded again after recovery. See [deployment and recovery](DEPLOYMENT_RECOVERY.md).
