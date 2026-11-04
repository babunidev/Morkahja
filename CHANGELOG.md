# Morkahja — changelog

**Author:** Babuni.dev

## 2026-11-04 — Unreleased: authentication, persistence and release-gate maintenance (PRs #5 and #6)

- **PR #5** (`security/one-time-session-challenges`): Added short-lived, single-use server-issued authentication challenges, bound to identity, device and registration/restoration purpose, with PostgreSQL-backed consumption and dual signatures. Updated client onboarding/recovery and authentication integration fixtures. **Open; not merged or deployed.**
- **PR #6** (`fix/atomic-player-avatar-writes`, based on PR #5): Replaced application-side read–merge–write in player/avatar document setters with PostgreSQL JSONB atomic UPSERT merges; serialized session lifecycle, daily encounter counters, reward-claim metadata, avatar/profile writes, purchases' unlocked-expansion initialization, friends and Wall of Fame operations where modified; added parallel persistence test coverage. **Open; not merged or deployed.**
- Added `npm run test:persistence --prefix server` to the server scripts and CI release gates. No gameplay or user-data migration was performed by this documentation change.
- **Verification:** Authentication and persistence tests passed on a separate Nobara/Podman PostgreSQL test worktree. GitHub Actions passed static-data verification, authentication/persistence, achievements, dice, and client build. Earlier CI failed on TypeScript errors; later PR #6 CI runs passed the complete typecheck.
- Corrected pre-existing server TypeScript diagnostics in encounter/solution test fixtures, typed progression test reads and the solo checkpoint type import. No gameplay-rule change. **GitHub Actions release-gates run #69 passed completely** at commit `c9a1c311` (static data, session auth, persistence concurrency, achievements, dice, client build, and typecheck).
- Corrected a room regression test that expected a late-joining guest to choose during the host's system event; the implemented state is `witnessing` for non-actors. Added the room regression suite to CI. **Verified:** GitHub Actions run #82 passed all steps, including `test:rooms`, at commit `d191729f`. Gameplay runtime behavior was unchanged.
- Corrected the solo-room rejoin test to count persisted `adventure_started` events for its own player and avatar instead of counting entries in the capped, mixed-visibility Scribes feed. Reused development databases can change the feed's visible event-type totals without changing the number persisted for one player. No gameplay behavior changed. Verification pending.
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
