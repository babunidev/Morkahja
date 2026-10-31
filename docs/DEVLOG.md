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
