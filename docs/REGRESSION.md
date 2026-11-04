# Integration regression protocol — 4 November 2026

**Status:** Prepared, not yet accepted on the developer's combined local checkout. Automated CI checks do not replace browser gameplay verification. No production deployment or merge is implied.

## Branch scope and safety

The integration stack is [PR #5](https://github.com/babunidev/Morkahja/pull/5) (authentication), [PR #6](https://github.com/babunidev/Morkahja/pull/6) (persistence), and [PR #7](https://github.com/babunidev/Morkahja/pull/7) (release-gate repair and review corrections). All remain isolated from the developer's unpublished local commits and uncommitted work. The branch `fix/integration-release-gates` contains the full stack.

Use only a **separate test worktree** and **disposable local PostgreSQL data**. Never point regression tests at production or run `git reset --hard`, `git clean`, or a force-pull against the original checkout. Keep any recovery keys and account data out of screenshots, logs and public issues. If the original checkout has unpublished commits, first integrate the remote stack with a separate worktree created from local `HEAD`; tracked working changes may be copied as a private patch and reviewed, not automatically discarded.

## Automated checks

From the test worktree, with PostgreSQL 16 running locally (for example, via Podman bound to `127.0.0.1:4242`):

```bash
npm ci
export DATABASE_URL="postgres://postgres:postgres@localhost:4242/morkahja"
npm run verify:static-data
npm run test:session-auth --prefix server
npm run test:persistence --prefix server
npm run test:achievements --prefix server
npm run test:dice --prefix server
npm run test:regression --prefix server
npm run test:rooms --prefix server
npm run test:inventory --prefix server
npm run build --prefix client
npm run typecheck --prefix shared
npm run typecheck --prefix server
```

Further targeted checks: `npm run test:encounter --prefix server`, `npm run test:lifecycle --prefix server` and `npm run test:commerce --prefix server`. Record the **actual command, checkout SHA, database/environment, result and exceptions** rather than inferring a pass from CI.

## Manual browser acceptance — unverified until performed

1. **Registration / recovery:** Create a test journey, save the recovery key, log out and restore the same player and avatars. Test invalid/reused challenges through the automated suite. A recovery key cannot restore an account missing from a fresh database.
2. **Avatar lifecycle:** Create/select an avatar, verify starting items are immediately visible and match persisted inventory, refresh, return to the dashboard and reselect. Test the configured living-avatar limit and deceased/failed restrictions.
3. **Encounter / dice / progression:** Roll and Continue in a solo encounter; verify that exactly one outcome commits, experience progresses, and a refresh does not duplicate a result. Verify pending level-up and its single-Continue system event.
4. **Inventory / currency / rewards:** Check a consumed solution's remaining uses, successful rewards, failed losses, daily progress, daily claim deduplication, gem donations and expansion costs. The CI persistence test deliberately interleaves grants, donations and heartbeats.
5. **Death / sacrifice:** Verify Atranor failure persists, no premature death finalization occurs, sacrifice costs are applied once, restored inventory/progression return, and deceased avatars cannot re-enter. Mark untested scenarios explicitly when natural gameplay does not reach them.
6. **Sessions / tabs:** Keep two tabs open on one test account; verify shared sessions, heartbeats, logout, restoration and that separate avatars do not exchange inventory or progression. The observed simultaneous-avatar behavior is intentionally retained, not guaranteed conflict-free.
7. **Multiplayer / reconnect:** Use distinct test accounts/browser profiles; create/join a room, select actions, leave and rejoin, verify the room snapshot and result consistency, host departure, slot handling and no double grant.

Record a pass only after checking persisted server state and visible behavior. If a case cannot be reproduced, mark it **not tested**, not passed. Do not promote this stack into production from CI alone.

## Evidence and known limitations

- Authentication and persistence tests were previously reported passing on the isolated Nobara/Podman checkout; those tests did **not** include integration of unpublished local edits.
- Initial PR #7 CI passed the static data, authentication, persistence, achievement, dice, client-build and TypeScript steps. Expanding the CI run exposed previously unexecuted room/level-up regression assumptions, addressed separately on this branch. Final expanded-suite status must be confirmed from GitHub Actions.
- The comprehensive browser checklist and original-local-checkout merge are not yet verified.

## Current automated evidence — 4 November 2026

[GitHub Actions release-gates run #78](https://github.com/babunidev/Morkahja/actions/runs/41766441723) completed successfully at integration commit `b2aac235`: static data, auth, persistence, achievements, dice, encounter/solution/level-up, rooms/solo checkpoints/death, starter inventory, client build and TypeScript checks. Prior runs exposed outdated tests and one intermittent host-after-guest-departure assertion. Its underlying cause remains open despite the later pass. No browser step in this protocol has been performed on the developer's combined local unpublished worktree; all manual cases remain **not yet verified**.

**Latest CI verification:** [Run #80](https://github.com/babunidev/Morkahja/actions/runs/41766927692) succeeded at `e434b78` after making the guest-departure room regression use deterministic favorable dice. The earlier intermittent behavior on random outcomes remains an unverified edge case, not an accepted gameplay change. Local integration and manual browser checks remain pending.
