# Morkahja — decisions and provenance

**Author:** Babuni.dev

The current project organizes playable client, authoritative server services and shared contracts into one workspace. Browser screens include a credited About Us area with Babuni.dev as author and separate musical contributor credit for Nikita Malko. These are source-observed choices, not a recovered list of acceptance discussions.

Consult [original development journal](../DEVLOG.md) for dated implementation notes. Never reconstruct missing author approvals from a feature's presence alone. AI contributions remain credited separately.

## D-002 — Server-authoritative death and encounter state (historical evidence)

The **May 22, 2026** original journal records removal of a client-side Atranor fatal-roll shortcut and movement of Misery/Hardship outcomes through the server's `POST /encounter/continue` path. Shared dice interpretation was also introduced. This demonstrates an implemented architectural change; the surviving entry does not by itself record the full human–AI discussion or acceptance chain. Current behavior remains untested in this audit.

## D-003 — World activity as visible narrative (historical evidence)

The May 20–22 entries record a persisted game-event pipeline, **SCRIBES** overlay, achievement and gem events, and notification refinements. Those systems provide a historical basis for describing how encounter results became an ongoing activity record. Do not attribute unrecorded design deliberations to Babuni.dev or to AI.

## D-004 — Public alpha infrastructure and its limits

The May 23 journal reports a Hetzner-hosted public alpha, HTTPS/nginx/PM2 architecture and a pre-invite security review. These entries do not certify the present live deployment, its security or the completion of then-recommended protections. Preserve the distinction between *historically reported* and *independently verified today*.

## D-005 — Documentation audit #30

**Babuni.dev direction:** Continue the GitHub documentation sequence, preserving creative ownership and keeping code untouched. **AI implementation:** Create missing design/content records and cross-reference chronological evidence. **Status:** Documentation committed; no source/runtime changes and no new game test results.

## 2026-10-31 — Canonical repository publication direction

Babuni.dev chose the actual project repository as the intended public source, replacing the earlier documentation-only edition once review and anonymous access succeed. Retain the current public edition during the transition. License and third-party redistribution decisions remain explicit author decisions.

## 2026-10-31 — Author decision — open project development

**Babuni.dev direction and decision:** Babuni.dev decided to make the actual project repository publicly accessible, with the intention of developing it openly rather than maintaining a separate public documentation edition. GitHub visibility was verified as public on 31 October 2026.

Babuni.dev clarified that project artwork was generated with AI and then manually cut out, arranged and composed in Photoshop/GIMP, including portraits, frames, item images and substantial UI work. Babuni.dev also manually entered project data. The music has a separate human author credited in About Us. This describes creative provenance; permission to redistribute contributed music is not inferred. The fuller development history remains a living work in progress.

**AI contribution:** Recorded the author’s decision and clarification, separately from observed GitHub visibility. Earlier documentation-only publication was considered and is superseded as the intended long-term source. No root license was selected by this update; public visibility, open-source reuse permissions, media rights and production readiness are separate matters. No runtime testing or behavior change is claimed.

## D-006 — Stateless revisioned content editing for administration (2026-11-07; implementation proposal awaiting review)

**Human direction:** A secure administration API should support edits to all five content categories, validation, revision conflict handling, idempotent publishing, rollback, auditability and safe authentication.

**AI implementation choice, not an independently approved production decision:** Rather than storing mutable drafts, the API accepts 1–100 complete-record create/update changes tied to a published base revision. The server clones that revision, validates the resulting five-category bundle, publishes a new immutable revision and confirms the current pointer. The existing bearer-key authorization is retained, avoiding a second login system while hardening comparison and rate limits. Legacy direct writes are retired. No new artwork identifiers are permitted until a separate upload/staging pipeline exists.

**Safety rationale:** Explicit base revisions avoid silent overwrites and permit reproducible retries. A separate `MORKAHJA_ENABLE_CONTENT_PUBLISHING` flag defaults to off so the unpinned active-encounter and room systems cannot be exposed to publishing by mere code deployment. A private audit log adds operator traceability within the limits of one shared credential.

**Open items:** Per-operator identities, production TLS/proxy enforcement, durable off-host audit backups, media file existence checks, image staging and active encounter revision pinning are not completed. The implementation remains in draft PR #12 and does not attest to a production security review.

## D-007 — Immutable, revision-addressed artwork (2026-11-07; review-stage implementation)

**Human direction:** Artwork editing should preserve encounter, solution, portrait and frame filenames, validate uploads, prevent accidental collisions, keep data outside deployments, publish with JSON, refresh replacements and retain history.

**AI implementation choice, pending repository review:** WebP files are staged as private SHA-256 objects; a content revision manifest associates stable logical image names with immutable hashes. Public URLs contain the revision and logical name. The single JSON/content-pointer swap is the visibility boundary for related data and artwork; unchanged legacy artwork is not forcibly migrated. Administrative upload requires an authenticated WebP request and the existing explicit publishing opt-in. Create and replace are distinct intents.

**Rationale and limits:** This avoids rewriting image bytes while a player or client references an earlier revision, and allows safe retries and rollback. Actual production legacy-file existence, full WebP pixel decoding, external image backups, browser runtime asset selection and active-encounter pinning are not verified. These are review and deployment blockers rather than implicitly approved functionality.

## D-008 — One validated browser content snapshot (2026-11-07; review-stage implementation)

**Human direction:** Replace build-time authored-data imports with a shared, revision-aware frontend store covering encounters, solutions, expansions, frames, portraits and artwork, while preserving loading/error behavior.

**AI implementation choice pending approval:** A single browser external store fetches GET /game-data/content and revalidates with ETag. Each response must validate as a complete five-category bundle and reference coherent revision-specific media URLs before the observable snapshot changes. Components subscribe to the same store; screen entry and active use revalidate without combining partial category responses.

**Compatibility/safety:** Original checked-in data remains in that single store only when the server expressly returns CONTENT_NOT_CONFIGURED. Unexpected errors and malformed published responses retain last-good data rather than silently returning to Git. The client still cannot guarantee live gameplay revision safety while active solo/room server snapshots remain unpinned. This is a draft implementation and not an approved deployment.

## D-009 — Preserve one content revision through ongoing gameplay (2026-11-07; review-stage implementation)

**Human direction:** Active solo and multiplayer encounters must keep compatible definitions through publication, prepared encounters, rewards, reconnect and persisted player-owned IDs.

**AI implementation choice pending review:** Every newly generated server encounter/room stores one immutable published content revision. Historical revision lookup verifies the original on-disk data; all participant slots, room events, rewards, inventory resolution and pre-death restoration refer to that version. An explicitly missing/corrupt historical revision fails closed instead of loading the newest content. Legacy untagged snapshots are mapped to the checked-in baseline as a compatibility convention, not silently to current data. Global published-ID preservation and category-identity checks do not inspect private player records.

**Alternatives and limitations:** Always reading the latest content was rejected because new solution definitions or follow-up mappings could alter a pending choice. Automatically writing a current revision onto old snapshots was rejected because it could misrepresent old fate. Historical content retention increases storage needs. Existing production snapshots may not match the checked-in baseline and require a read-only migration audit; real database concurrency and historical browser presentation remain open review gates. This draft does not authorize live publishing.

## D-010 — Keep application deployment and content recovery independent (2026-11-07; review-stage implementation)

**Human direction:** Git pulls, frontend builds and destructive static synchronization must not overwrite published content or managed artwork. Backups must survive loss of the production server. Application-code rollback must be distinct from content rollback, with compatibility considered explicitly.

**AI implementation choice pending review:** Require non-overlapping application, persistent content, static web and off-host backup paths before deployment. Back up the complete committed revision history and referenced artwork before updating application files. Keep backup inventories checksummed and restore only into a fresh content root. Scope rsync deletion to the dedicated static web root. Proxy managed media through the existing revision-aware Express endpoint instead of exposing the external content directory through Nginx.

**Alternatives and limitations:** Restoring a backup over an active content directory was rejected in favor of creating a new root and switching the application environment only after verification. Copying the content directory with rsync --delete as part of application deployment was rejected because application and authored-world lifecycles are independent. A repository snippet cannot certify a live Nginx configuration or prove a backup mount is off-host. The scripts do not back up PostgreSQL player data, secrets or pending upload stages. Real host integration, encryption/retention, a restore rehearsal and old-application compatibility remain required before production use.
