# Morkahja — changelog

**Author:** Babuni.dev

## 2026-11-04 — Unreleased: integration/typecheck and regression-test repair (PR #7)

- Brought legacy encounter and solution test fixtures into alignment with current `EncounterData`/`SolutionData` types; typed pending-level-up progression reads and imported the existing checkpoint type in `roomService.ts`.
- Corrected initial avatar creation to persist matching starting inventory and avatar contents in one transaction; refined Hearth Blessing notification deduplication.
- Added targeted encounter, level-up, room, and inventory tests to GitHub Actions; updated tests to isolate distinct solo scenarios, acknowledge the existing one-Continue level-up flow and verify fresh room rejoin events by ID within the bounded Scribes feed.
- **Status:** Prepared as a stacked unmerged PR, not integrated with unpublished local changes, and not deployed. Initial PR #7 CI typecheck passed; expanded regression-suite validation and manual gameplay acceptance remain separate tasks.

## 2026-11-04 — Unreleased: authentication and persistence hardening (PRs #5 and #6)

- **PR #5** (`security/one-time-session-challenges`): Added short-lived, single-use server-issued authentication challenges, bound to identity, device and registration/restoration purpose, with PostgreSQL-backed consumption and dual signatures. Updated client onboarding/recovery and authentication integration fixtures. **Open; not merged or deployed.**
- **PR #6** (`fix/atomic-player-avatar-writes`, based on PR #5): Replaced application-side read–merge–write in player/avatar document setters with PostgreSQL JSONB atomic UPSERT merges; serialized session lifecycle, daily encounter counters, reward-claim metadata, avatar/profile writes, purchases' unlocked-expansion initialization, friends and Wall of Fame operations where modified; added parallel persistence test coverage. **Open; not merged or deployed.**
- Added `npm run test:persistence --prefix server` to the server scripts and CI release gates. No gameplay or user-data migration was performed by this documentation change.
- **Verification:** Authentication and persistence tests passed on a separate Nobara/Podman PostgreSQL test worktree. GitHub Actions passed static-data verification, authentication/persistence, achievements, dice, and client build. The full workflow fails on known pre-existing TypeScript errors in encounter/solution tests, pending level-up tests, and `roomService.ts`; no full typecheck pass is claimed.
- **Observed but unchanged:** One browser session opened in multiple tabs can play different avatars. Its current behavior is intentionally retained pending later feature design and independent multi-avatar stress testing.


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

## 2026-11-04 — Unreleased: expanded release gate passes on integration branch

- Corrected an old starter-inventory test that confused **13 Mage / 14 Warrior distinct seeded entries** with the greater number of individual item uses. Production starting items and their uses were not changed by this test correction.
- Expanded CI now exercises authentication, concurrency, achievements, dice, encounter/solution/level-up, room/death/checkpoint, inventory, static-data, client build and shared/server typechecks. All steps passed in [workflow run #78](https://github.com/babunidev/Morkahja/actions/runs/41766441723), integration commit `b2aac235`.
- An intermittent room test failure was also observed in an earlier CI run after a guest left; a more informative assertion records the room state when it fails. The root cause is not yet verified.
- **Unreleased:** No PR merged, original unpublished local changes not reconciled, manual browser regression and production deployment not verified.

- **Follow-up, PR #7:** Made guest-departure room regression deterministic by fixing both participants' dice to a favorable result. This prevents unrelated random outcomes from changing the test's expected flow; no production gameplay behavior was changed. [Release-gates run #80](https://github.com/babunidev/Morkahja/actions/runs/41766927692) passed the expanded workflow, including TypeScript checks. Earlier intermittent failures have not been conclusively traced to a particular engine defect.
