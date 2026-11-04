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

## 2026-11-04 — Preparing integration without sacrificing local work

The next priority for my game was to bring the separate authentication and persistence fixes into one reviewable release candidate. An existing Nobara working checkout still contains unpublished commits and uncommitted changes, so no automatic merge or reset of that checkout was acceptable. AI-assisted review therefore continued in [PR #7](https://github.com/babunidev/Morkahja/pull/7), stacked on the earlier two PRs.

During review, the old TypeScript errors proved to be mismatches in encounter and solution test fixtures, missing progression generics and a missing checkpoint type import. Fixing those compiler issues alone was insufficient: the broader tests revealed that a legacy level-up test reused an earlier solo checkpoint and still expected an obsolete second Continue step. Another room test assumed a bounded Scribes feed would keep all historical `adventure_started` entries. Rather than change the game's intended room behavior, the tests were adjusted to isolate their scenarios and check for new event identity.

A more material correction was also found: an avatar could be returned with an empty initial inventory while starter items were persisted in a later operation. AI-assisted code now persists a matching avatar and initial inventory together and tests that relationship. The daily blessing notification now checks which transaction actually wrote the notification flag. These changes remain in an **unmerged integration review**, not a production release.

**Verification boundary:** The earlier authentication and persistence suites passed in both CI and the isolated local test environment. An initial PR #7 CI run passed the previously failing TypeScript check; the expanded room and level-up suite was being validated during this documentation update. The original local work, browser acceptance, production deployment and comprehensive gameplay regression have not been verified. The manual checks are recorded in [the regression protocol](REGRESSION.md).

## 2026-11-04 — First complete expanded CI pass, with a remaining room question

The integration branch now runs more than the original release check: account security, PostgreSQL concurrency, encounters, level-up events, room departures, solo checkpoints, avatar death, inventory, frontend build and TypeScript validation. A newly enabled starter-inventory test exposed a mistaken assumption in its own assertions: thirteen Mage starting items meant thirteen distinct entries, not thirteen total usable charges. That test was corrected without changing the starting items or their permitted uses. The more extensive checks then completed successfully in [GitHub Actions run #78](https://github.com/babunidev/Morkahja/actions/runs/41766441723) on commit `b2aac235`.

An earlier run had also exposed an intermittent assertion when a guest departed a room after preparing a choice. The later successful run cannot prove that race absent. For my release decisions, the narrower truth matters: the expanded CI gate has passed on this remote integration branch, while the intermittent room behavior requires further investigation, and my unpublished local files, actual browser acceptance and production environment remain outside the verified result.

**AI assistance:** Reviewed both prior PRs, prepared the stacked integration branch, repaired outdated tests, corrected avatar initialization, expanded CI, examined failures and recorded test evidence. **Human direction:** Prioritize safe integration, full typechecking and gameplay regression without overwriting the Nobara development checkout. The original historical root journal remains unchanged.
