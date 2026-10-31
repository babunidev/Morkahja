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
