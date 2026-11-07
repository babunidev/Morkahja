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
