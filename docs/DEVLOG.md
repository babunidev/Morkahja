# Morkahja — development-history guide

**Author:** Babuni.dev

## Retrospective source organization — 2026-10-26

The existing [DEVLOG](../DEVLOG.md) is a substantial chronological record and remains the primary historical source. Morkahja's current repository contains the browser game, server services, shared contracts and artwork/content infrastructure. This new guide exists to prevent later portfolio summaries from losing the original sequence of decisions and tests. The original world, game-design direction and creative critique belong to Babuni.dev. AI-assisted coding or drafting should be tied to specific evidence and commits rather than assigned creative ownership.

This audit added documentation without executing the game's tests or validating production operation.

## 2026-10-27 — Audit #30: preserving the original development sequence

The original root [DEVLOG](../DEVLOG.md) is unusually valuable because it gives a dated sequence of the project's making, from organized encounter data on May 16 through the earliest playable game, interface experiments, persistent world activity, player progression and deployment work. This audit did not rewrite those numbered entries. Instead, it positioned them as the primary record against which shorter portfolio narratives can be checked.

The project history has a clear technical arc. A first playable checkpoint on May 18 united the React/Vite client, Express services, shared contracts and PostgreSQL storage. Subsequent May entries recorded music, the SCRIBES activity feed, visible encounter-result pacing, achievements, death rules, expansion unlocks and friends. Particularly revealing are the recorded revisions around server-authoritative Atranor death, shared dice interpretation and avatar recovery: they show development proceeding through correction, not a smooth retrospective success story.

The journal also reports a public alpha hosting phase on May 23, along with HTTPS and server-configuration lessons. Those notes are historical evidence only. A live service's current availability, safety and behavior cannot be proved from old deployment notes.

**Babuni.dev contribution:** The game world, its intended experience, original creative direction and demand for a faithful development record belong to Babuni.dev. **AI contribution in this session:** Identify documentation gaps, organize evidence and add source-grounded guide material. **Iteration:** Preserve the long journal and independent musical credits instead of compressing them into generic feature lists. **Implementation:** Markdown documentation only. **Verification:** Read the original journal and package metadata; no code execution, browser acceptance or live deployment testing.

## 2026-10-31 — Review before public visibility

Babuni.dev requested review of the actual private repository and its documentation before publication. AI inspected fetched Git history, documentation coverage and publication boundaries. The publication record separates source visibility from deployment, licensing and media redistribution; detailed private findings remain outside the portfolio. No build, gameplay, live account or database test was performed.

## 2026-10-31 — Publication direction and author clarification

**Babuni.dev direction and decision:** Babuni.dev decided to make the actual project repository publicly accessible, with the intention of developing it openly rather than maintaining a separate public documentation edition. GitHub visibility was verified as public on 31 October 2026.

Babuni.dev clarified that project artwork was generated with AI and then manually cut out, arranged and composed in Photoshop/GIMP, including portraits, frames, item images and substantial UI work. Babuni.dev also manually entered project data. The music has a separate human author credited in About Us. This describes creative provenance; permission to redistribute contributed music is not inferred. The fuller development history remains a living work in progress.

**AI contribution:** Recorded the author’s decision and clarification, separately from observed GitHub visibility. Earlier documentation-only publication was considered and is superseded as the intended long-term source. No root license was selected by this update; public visibility, open-source reuse permissions, media rights and production readiness are separate matters. No runtime testing or behavior change is claimed.

## 2026-11-04 — Hardening account recovery and shared player state

During local testing on Nobara, the newly isolated authentication worktree used a fresh PostgreSQL database; older recovery keys could not restore accounts absent from that database. Once the missing player records were understood, I confirmed the test game itself ran. The security change was aimed at preventing replay of predictable recovery proofs while keeping the existing recovery-key format. AI-assisted implementation in [PR #5](https://github.com/babunidev/Morkahja/pull/5) replaced that proof with a short-lived, single-use challenge signed by both identity and device keys. GitHub's authentication suite passed, and I later ran the same local authentication test successfully.

The next concern was concurrent persistence. Rewards, daily encounter progress, avatar edits and session heartbeats can touch the same PostgreSQL JSON document, and stale full-object writes could undo another request's updates. At my direction to prevent these lost updates, AI-assisted work in [PR #6](https://github.com/babunidev/Morkahja/pull/6) moved top-level merges into atomic PostgreSQL UPSERT statements and put selected read–modify–write operations behind row-locking transactions. A new test mixes parallel reward grants, donations, avatar changes, encounter counts and session activity. On Nobara with Podman/PostgreSQL, both `npm run test:persistence --prefix server` and `npm run test:session-auth --prefix server` passed. GitHub CI also passed these suites, the achievement and dice suites, static-data verification and the frontend build. The complete check still fails on existing unrelated server TypeScript errors, so this is neither a full release certification nor proof of production deployment.

A separate observation came from two tabs sharing the same browser account: actions on the same avatar appeared in both, while choosing another avatar allowed two avatars to be active at once. Rather than interrupt the more urgent fixes, I chose to **leave that behavior alone** and consider a smoother supported feature later. This is a development decision, not evidence that all multiplayer or multi-tab races have been tested.

**Provenance:** The priorities, local observations and decision to defer tab restrictions came from Babuni; AI drafted code, tests, PRs and documentation. Both PRs remain open and are based on the remote repository snapshot, while the original Nobara development checkout retains unpublished local changes. The historical [root DEVLOG](../DEVLOG.md) remains unchanged.

## 2026-11-04 — Repairing the release-gate TypeScript diagnostics

After the PostgreSQL race tests passed locally, the remaining full CI failure was traced to older encounter/solution test fixtures, level-up progression tests and a missing type-only import in the room service. To keep the gameplay implementation intact, the AI-assisted correction updates fixture records to conform to current encounter/solution contracts, reads typed progression state in the tests, and imports the existing checkpoint interface. No encounter rules or player database fields were changed for this maintenance. **Verification:** GitHub Actions release-gates run #69 passed completely at commit `c9a1c311`: static data verification, session authentication, persistence concurrency, achievements, dice, client build, and the full server typecheck. This is branch CI validation, not confirmation of merged code or production gameplay. Integration with unpublished changes in the original Nobara working directory and a full manual gameplay regression remain outstanding.

## 2026-11-04 — Testing the integrated room lifecycle

The separate Nobara integration branch, including the committed authentication and PostgreSQL changes, passed the complete `npm run release:check` and the PostgreSQL concurrency regression. Running `npm run test:rooms --prefix server` uncovered a guest-rejoin assertion at `roomService.test.ts:1228`: after the host advanced, the guest entered `witnessing` rather than the test's expected `choosing`. Source review showed that the room join logic deliberately treats a non-acting guest as a witness during system events, while the test already allowed the host to advance into that phase. The AI-assisted correction makes the test phase-aware without changing the room runtime and adds the room suite to GitHub CI. **Verification:** GitHub Actions [release-gates run #82](https://github.com/babunidev/Morkahja/actions/runs/41768507068) completed successfully at `d191729f`, including the newly added complete `test:rooms` suite, auth, PostgreSQL concurrency, achievements, dice, static data, client build and typecheck. This verifies the PR branch, not the locally merged integration with unpublished changes; the developer's local room test has not yet been rerun after the fix. The `pg` deprecation warning remains separate and unresolved.

## 2026-11-04 — Correcting the solo-room rejoin event test

The Nobara integration worktree (`6ab4cb11`) passed `release:check` again, but `npm run test:rooms --prefix server` failed at `roomService.test.ts:1302`: the `adventure_started` count shown through the activity feed stayed at 13 when the test expected 14. Source inspection showed the rejoin path awaits the event write, while the Scribes query returns at most 50 recent global and player-relevant events. A count in that sliding window is not a stable measure of events saved for an individual player. AI assistance replaced this test assertion with a parameterized PostgreSQL count scoped to the test player and avatar; no gameplay rules or Scribes behavior changed. **Verification:** This is a source-grounded correction, not yet rerun against Nobara's populated test database. CI validation is pending, and the separate PostgreSQL-client deprecation warning remains open.
