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


## D-006 — Game URL beneath babuni.dev

**Human direction (2026-11-09):** After losing control of the former game domain, Babuni chose `https://babuni.dev/Morkahja/` as the intended public game address. The main website remains at `https://babuni.dev/`.

**Rationale:** Keep the game on the existing domain without purchasing another domain, while keeping the website root and game application separately addressable.

**Technical interpretation:** DNS cannot route URL paths. The server or reverse proxy handling `babuni.dev` must route `/Morkahja/` to the game frontend and a dedicated API prefix to the existing Express API. The repository already supports a configurable API base URL, but the Vite base path, runtime asset URLs, PWA manifest and production URL settings require work.

**Open infrastructure choice:** It is not yet established whether the main website and game will share a host or use a reverse proxy between separate hosts. Current DNS, hosting, Nginx and production database state have not been inspected.

**Status:** Approved target address and documented plan; implementation not started or verified. Preserve the existing player database. Browser storage is origin-scoped, so existing players will need the current recovery-key restoration flow at the new address; automatic transfer of the old session/local storage must not be promised.

**AI contribution:** Inspected current repository configuration and documented the migration plan and constraints. No application code, server, DNS, database or Stripe configuration was changed.

**Update (2026-11-10):** Babuni directed implementation and local verification of the repository changes, with production changes held until explicit approval. They are on branch `feat/babuni-dev-subpath`, unmerged and undeployed. Public discovery showed that the apex `babuni.dev` points to Porkbun parking with no HTTPS certificate, while the website runs on `www.babuni.dev`.

**Human decision (2026-11-10):** Asked to choose between connecting the apex to the website host and using the existing `www` host, Babuni chose **`https://www.babuni.dev/Morkahja/`**. This supersedes `https://babuni.dev/Morkahja/` as the target address. **Rejected for now:** changing the apex DNS record and certificate. **Consequences:** No DNS change is needed for the move. The game's browser origin is `https://www.babuni.dev`. If the apex is connected later, redirecting it to `www` avoids splitting players' browser storage across two origins; that redirect is a recommendation, not a decision. Implementation details (asset helper, relative manifest, trust-proxy default) are AI implementation choices, not human decisions.

**Human approval (2026-11-10):** Babuni approved and personally ran the production cutover (backup and deploy phases with their own `sudo`). Deployed commit `95fd5c5a`; see `DEPLOYMENT.md` for the evidence and remaining follow-ups.
## 2026-11-04 — D-006: Prevent lost player/avatar updates before feature polish

**Human direction:** Prioritize preserving player/avatar state under simultaneous rewards, gem spending, daily encounter progress and session changes. **AI-assisted implementation:** [PR #6](https://github.com/babunidev/Morkahja/pull/6) introduces atomic PostgreSQL top-level JSONB merges and selected row-locked transactions, building on authentication [PR #5](https://github.com/babunidev/Morkahja/pull/5). **Reasoning:** A separate read followed by a full document overwrite can erase changes made by another request. **Boundary:** JSONB `||` merges only top-level keys; nested counters and multi-document invariants still require coordinated transactions. Tests passed in CI and locally, but both PRs remain unmerged, the overall typecheck is red for unrelated existing errors, and production has not been verified.

## 2026-11-04 — D-007: Allow existing multi-tab/multi-avatar behavior for now

**Human decision:** Do not restrict multiple tabs or simultaneous avatars at this stage. Two tabs on the same avatar were observed to reflect the same server-side actions, and switching to another avatar made concurrent play possible. This behavior is acceptable for now; dedicated multi-avatar polish can be a later feature. **Rejected for now:** Blocking duplicate tabs or forcing only one avatar to play. **Risk retained:** The observation does not prove avatar isolation, resource conservation, cross-tab UI synchronization or correct room transitions in every race. Do not treat it as a guaranteed supported feature before targeted tests.

**Implementation:** No runtime change was requested for the tab behavior; this records direction, not a completed new feature.

## D-008 — Visible progress is not an earned achievement (2026-11-04, confirmed 2026-11-10)

**Babuni's direction:** An achievement chain becomes visible when progress exceeds zero. Neither a bonus nor an achievement-unlocked notice is earned until a defined milestone is reached. Combatant must complete 50 successful combat encounters for its first rank; Pathfinder should correspond to three created avatars rather than the first avatar.

**AI implementation for review:** The client watches for rank increases, rather than first visibility. The server grants rank-based Hearth Blessing bonuses and avatar display titles only for earned ranks. Firestarter's four milestones were arranged as two avatars (Firestarter), three avatars (Pathfinder), 15 combined avatar levels (Wayseeker), and 30 combined levels (Fateforger). The 15-level threshold was first proposed by AI. Stored Firestarter progress is retained, with legacy max-rank encoding preserved.

**Verification boundary:** GitHub Actions run [41766029656](https://github.com/babunidev/Morkahja/actions/runs/41766029656) passed all 11 focused achievement tests and static-data verification. Overall release-gates failed separately at session authentication because PostgreSQL was not available at `localhost:4242`. Full gameplay, client typechecking, deployment, and database-backed regression have not been verified.

**Babuni's confirmation (2026-11-10):** (1) Apply the daily-gem change: one base gem plus one per earned rank, removing the former +1 per chain at rank 0, although existing players receive a smaller daily claim. (2) Wayseeker is earned at 15 combined avatar levels. (3) Ranks never go down: a Firestarter rank earned under the old milestones (for example rank 1 for a single avatar) is kept; the revised milestones apply only to further rank-ups. **AI implementation:** Firestarter rank is the higher of the stored rank and the rank computed from peak progress, both when syncing and when reconciling stored records; tests cover kept legacy ranks and new-player milestones.

## D-009 — AI may run production releases through one restricted command (2026-11-11)

**Babuni's direction:** releases kept stopping because every root step needed Babuni's `sudo` password. Babuni asked for the server to be set up "so that it works in the future, that you can deploy stuff yourself."

**AI implementation:** a root-owned `morkahja-deploy` command with fixed phases (`status`, `backup`, `release`, `rollback`, `frontend`, `frontend-rollback`) and a sudo rule that lets the deploy login run that command, and only that command, without a password. The command backs up before every release, never resets, reseeds or restores the database, and rolls back automatically when the new backend fails its health checks. Babuni installed it with `sudo` on 2026-11-11 and checked that the installed file's SHA-256 matched the reviewed copy.

**Boundaries:** the rule does not grant general root access; changing the command itself still needs Babuni's password. Database restores remain a separate, explicit decision. Not decided: whether each future release needs Babuni's approval. Until Babuni says otherwise, AI asks before running `release` or `rollback`, as with any outward-facing production change.

## D-010 — Use the standalone version's game screen in the web game (2026-11-11)

**Babuni's direction:** after replaying the standalone desktop version, Babuni preferred its layout: "the sizes are better, the button size and stuff, and it feels more free, and there's more room for the background and less UI elements that are pretty much in the way." Babuni asked for all of it in the web version: the new layout, the encounter title on hover, solution icons flying from the inventory, and essences shown as lives under the avatar. The work is tested on a branch and played locally before any merge.

**AI implementation:** visual and layout code only, merged three-way from the June base, today's web code and the standalone. Offline-only removals in the standalone (Call for help, Friends-only slots, lore gem rewards, gem sacrifice, daily gems, recovery key, payments, local saves, nearby play) and its changes to multiplayer rules were not taken.

**Status (2026-11-11):** after playing the branch locally, Babuni confirmed the layout ("I do like the design decisions that I made there") and then directed further changes to the result presentation (see D-011 and the CHANGELOG). **Open:** the mobile layout, which the standalone did not target.

## D-011 — Collect rewards and losses to continue (2026-11-11)

**Babuni's direction:** remove the Continue button without changing how a round proceeds: "the way the play proceeds should be by pressing the reward or loss, only if there is no reward or loss the player should be served the continue arrow, otherwise we dont want to show it and the player is tabbing the rewards to collect them and continue."

**AI implementation:** in the result, each reward (including an earned lore gem) and each loss is tapped to collect it; the last one triggers the same continue request as the arrow did. Without anything to collect, and for players watching someone else's turn, the Continue arrow remains. If continuing fails, the collected items return so the player can try again.

**Open:** whether collectable items need an extra visual hint beyond their existing gentle shake; behaviour on touch screens, where the first tap may also show the item's tooltip.

## D-012 — Bot adventurers live on the production server (2026-11-11)

**Babuni's direction:** keep "some adventurers active on the server all the time, so some bots playing, just to give the game a little bit of life and randomness, and also to have someone available when someone needs help", with more fantasy names.

**AI implementation:** the three test bots run on the production server as normal accounts named Varrokh, Sylvaen and Thalyss, with the same behaviours as in testing (always adventuring, waiting helper, on-and-off player). They use only the public HTTP API from the same host, under PM2 next to the API, and can be switched off with `MORKAHJA_BOTS=0`.

**Status:** live since 2026-11-11 (release `a40a6c5c`). **Babuni's decision (2026-11-11):** the bots are not marked as bots: "people don't need to know that it's bots ... It's just could be other players." Babuni also observed them appearing in the activity feed as normal. Their effect on achievements has not been reviewed.

## D-013 — Line frame and wait timer on the encounter picture (2026-11-12)

**Babuni's direction:** replace the long bar graphics around the encounter picture with lines: a 2 px line, a 2 px line "randomly interrupted, so it has gaps", a 1 px line, a little distance, and an outer line, with cut-off corners filled by small triangles inside and cut outer corners. The bottom line behind the solutions and rewards acts as a timer: while waiting for an animation, it "shrinks from the outside towards the element that is working right now ... in the timing that the animation needs", including the wait until a reward or loss can be picked, and it fades in.

**AI implementation:** SVG lines with 45° cut corners and seeded random gaps; a small shared timer (`frameTimer.ts`) that each animation starts with its target and duration; overlapping waits follow the one that ends last.

**Status:** implemented on `fix/mobile-centering`, not yet accepted after Babuni's own play or released. Line colour, thickness of the timer and the corner size are AI choices open to change.

**Revision (2026-11-13, Babuni's direction):** the timer counts two phases per encounter instead of single animations: from the encounter appearing until the solutions are usable, and from using a solution until the reward, loss or Continue arrow is usable ("So in the end, we would actually only have two rounds").

## D-014 — The encounter's line frame on every panel and tooltip (2026-11-13)

**Babuni's direction:** all elements that have a frame — "the tooltips, the avatar creation, all the menus in the main menu" — get "the same concept of a frame that we have on the encounter", possibly "a little thinner": a line, a disrupted line, a thin line, a little gap and another line, with a little triangle in each corner.

**AI implementation:** one `LineFrame` component drawn inside the element's edge, with the background cut to the frame's octagon; two thinner sizes (panel, tooltip) of the encounter's line set; buttons and inner cards keep their borders.

**Status:** implemented on `fix/mobile-centering`, not yet accepted after Babuni's own look or released. Exact line widths, the tooltip marker on the cut corner, and which smaller elements count as framed are AI choices open to change.

## D-015 — Simple frame inside panels; the beta number counts development steps (2026-11-13)

**Babuni's direction:** buttons "that have a simple yellow frame" and "the elements in the menus" get the new frame concept; around fields and entries "a simple one. So only the line that we have already, and then one interrupted line around it. No round edges", with the corner triangles. Dividers become "the line plus one disrupted line" that "could be connected to the frame by little triangles"; the achievement progress bar gets "the cut edges". Version: "It's definitely 0.9.0, but it is beta ... now it would be 22, and then ... every development step can be one number there."

**AI implementation:** `simpleFrame.ts` (nine-slice SVG border image) for buttons, fields, cards, badges and bars; `frameDividerStyle` for dividers. Version 0.9.0-beta.42: 22 plus 20 steps, counting the 19 changelog entries since 0.9.0-beta.2.2 that changed the game, its deployment or its tests (documentation-only entries not counted) and this step.

**Status:** implemented on `fix/mobile-centering`, not yet accepted or released. Buttons use the simple frame, not the four-line panel frame (an AI choice; small buttons have little room). Each later development step raises the beta number by one.

## D-016 — Undo and redo in avatar creation keep later steps (2026-11-13)

**Babuni's direction:** an undo button left of the name and a redo button right of it, subtle and round with curved arrows; every action saves the combination in "a normal list". On a change after stepping back, Babuni first said "it removes what followed after", then specified that "it still keeps these changes inside this gap, and I go forward to the next stuff that I did afterwards, so that it fully works going forth and back".

**AI implementation:** the second description: a change after undo is inserted after the current step and later steps remain (`creationHistory.ts`). Typing a name amends the current step.

**Status:** implemented on `fix/mobile-centering`, not yet accepted or released. Switching to the first description (drop later steps) is a one-line change if preferred.

## D-017 — Essence slots on the avatar (2026-11-13)

**Babuni's direction:** essences shown not in the tooltip but on the bottom edge of the round avatar, five small symbols: "one in the middle, down in the center, and then 2 on the left, 2 on the right". A loss is "consumed from these 5 slots"; emptied slots are "replenished with some from the inventory whenever we enter the next encounter"; a collected essence "should move in the slot directly" if a slot is free, otherwise into the inventory.

**AI implementation:** a client-side slot store (`essenceSlots.ts`) over the server inventory; slots fill centre-out and empty outside-in (an AI choice); the refill starts 0.7 s after a new encounter appears, staggered per slot.

**Status:** implemented on `fix/mobile-centering`, not yet accepted or released.

## D-018 — Atranor items are not essences (2026-11-13)

**Babuni's direction:** Atranor items (Elixir, Scroll, Stone, Dragontooth) "should not go to the slot at all. They should go to the inventory, because they are used in Atranor ... to revive or make the passage guaranteed", and they should not be used up like an essence.

**AI implementation:** only solution type 15 counts as an essence for the avatar's slots and for Hardship/Misery losses; Atranor items (type 77) stay in the essences container for storage and are only used as solutions in Atranor.

**Status:** live since 2026-11-13 (release `49fb6809`, 0.9.0-beta.51).

## D-019 — Encounters that need several solutions are chosen one at a time (2026-11-13)

**Babuni's direction:** in an encounter that needs two or more solutions, "the solution that I choose ... hover[s] over the slot, waiting for another solution"; when the last one needed is pressed, "all of them move into the encounter". The set can mix items and skills from different slots. With too few solutions, the chosen ones still hover and the dice finishes the set. "Each item that I use for this encounter ... needs to have its own roll", and the rolls "should be combined to one outcome, and that defines my success."

**Babuni's choices (asked by AI, answered 2026-11-13):** the rolls are **averaged**; the dice roll **counts once for each missing solution** (one item and the dice for two missing: the item counts once, the dice twice); the **same slot can be tapped again** for another copy (shown as ×2); **tapping a hovering solution puts it back**, and nothing is spent until the set is complete.

**AI implementation:** the number needed is the encounter's difficulty (1–4), which also used to be "how many copies of one slot's item"; a slot is now usable with a single charge. Shared rules in `shared/src/solutionSet.ts`; per-copy rolls in the same ranges as the slot's own (items 61–100, alternatives 50–100); losses, rewards and the outcome table are unchanged and read the averaged roll. Encounters needing one solution play as before.

**Status:** live since 2026-11-13 (release `c6e6dd20`, 0.9.0-beta.53), released at Babuni's request to test with high-level accounts.

## D-020 — Everything fades; menus open once their pictures are loaded (2026-11-13)

**Babuni's direction:** "all elements need to fade in and fade out", including the other solutions while the chosen one plays, the result on the avatar and the in-game tooltips. Menus and Lore were "less smooth" the first time: "load it first and then show it", and "pulsate the button that we pressed, until everything that is inside the menu is loaded", so that, for example, the Friends list has its avatar pictures ready. A newly created avatar should be added "with 0 opacity and then bring it to 100 as soon as it is in position and ready, loaded". Inventory tooltips on phones glitched: "make the hitbox a little bit bigger".

**AI implementation:** the other choices fade out over 0.7 s while the chosen solution, set or dice plays; every game tooltip fades over 200 ms (the avatar and choice-badge tooltips had no fade); menus and the Lore, Inventory and Skillbook panels open once their pictures are decoded (at most 3 s), with the opening button pulsing; avatar slots fade in once their pictures are decoded. On phones an inventory item is a plain tap (show, tap again to hide): the long press and the browser's emulated mouse and focus events after a touch made the tooltip flicker. The whole grid cell is the touch target, and the panel title no longer covers the top edge of the first row.

**Also from this request:** the Babuni.dev and Nikita Malko texts in About Us were shown twice (a rendering bug, now once); Claude is named among the tools; the "Operational Costs" card with its figures is removed at Babuni's request ("I don't think anyone needs to know that ... if they are interested, they can ask") and replaced by "Keeping Morkahja Alive": one person pays for everything, the game earns nothing yet, donations are very welcome and in-game purchases even more (revenue could one day help find an investor), and support buys time for the game, with babuni@babuni.dev as the contact; the author card shows "Alexander Ludwig aka Babuni" (Babuni's own wording and choice to be named publicly in the game) with a Website button to babuni.dev; the privacy policy contact becomes support@babuni.dev (from Babuni's list babuni@, feedback@, support@; the policy's effective date left as it was) and the donation panel says "Donate directly to Babuni"; "Full changelog" opens the babuni.dev living grid on Morkahja's Changelog (`#project=morkahja-rpg&bloom=big&read=changes`).

**Status:** live since 2026-11-13 (release `14f7bf6d`, 0.9.0-beta.54).

## D-021 — Terms and privacy policy describe the game as it is (2026-11-13)

**Babuni's direction (after an AI review of both texts):** "the key is the key", so the welcome button says "Use Your Key"; the operator is "my actual name ... on my AKA", Alexander Ludwig aka Babuni, without "Babunigaming"; fix the outdated and missing points; friendships stay one-sided ("Friends is more like a link between people to play together") and the texts disclose that; the bots are only for testing and need no mention; the game is 18+, "kids only with their parents", with a kid-friendly or adult-content on/off setting in the future "whenever there is adult content added"; a warmer tone for the terms; instead of naming AI tools, point to the documentation and development logs on babuni.dev; refunds: no extra step before Stripe, so soften the wording in the terms.

**AI implementation:** both texts rewritten against the code and the server: Stripe checkout and the stored purchase record, one-sided friend links and what friends see, IP addresses only in web server logs (14-day rotation, checked read-only on the server) and briefly in memory for sign-in rate limiting, Hetzner in Finland, no third-party resources loaded. Added the right to complain to IMY, US transfers by Stripe and PayPal, retention periods, and a contact in the terms. Refund wording: "normally final ... we will find a fair solution. This does not limit any rights you have under consumer law."

**Not legal advice; open points:** EU consumers normally have a 14-day right of withdrawal for digital content unless they agree, before delivery, to immediate supply and acknowledge losing that right. Without that consent at checkout, the softened wording leaves the statutory right in place rather than excluding it. The seven-year purchase-record period follows Swedish bookkeeping law and should be confirmed for Babuni's situation.

**Status:** live since 2026-11-13 (release `14f7bf6d`, 0.9.0-beta.54).

## 2026-11-13 — Licensing decision

To make the reuse terms explicit, I approved MIT for original software and CC BY 4.0 for eligible original creative material, excluding commissioned music and externally sourced sound assets. This applies only to material for which the relevant rights can be granted; third-party contributors keep their own credits and licenses. AI assistance committed the license notice and updated project-facing documentation. This was a legal/documentation change, not a runtime feature or test.
