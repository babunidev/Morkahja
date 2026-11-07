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
