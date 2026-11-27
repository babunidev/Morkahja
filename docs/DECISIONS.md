# Morkahja — decisions and provenance

**Author:** Babuni.dev

## 2026-11-27 — Difficulty determines action count, not slot count

My four visible solution slots are reusable and refill from inventory. An encounter with effective difficulty N requires N actions, including repeated use of a slot, refilled slots or dice alone; D7 requires seven actions and rare D8 requires eight. There is no four-action design limit. The earlier rarity handoff's open high-difficulty design question is resolved. ChatGPT (GPT-6.2) corrected the developer brief and distinguished the intended behavior from the four-action clamp still present in inspected shared source. Verify and correct that implementation as necessary; no game code changed.


## 2026-11-27 — Dynamic encounter rarity and authored difficulty

Every geographic encounter in my game should have a one-in-twenty chance of appearing as a rare version. At server preparation, a rare appearance gains one effective difficulty level, an increased reward and a recognizable frame; its story and identity do not change. My Vale encounters are all authored at difficulty 1, including the two scripted sanctuaries, while other expansions keep their authored difficulties. This replaces the earlier six rare IDs and 114/6 difficulty quota. The two universal system events remain separate. Existing item rarity is unchanged. The [developer brief](DEVELOPER_BRIEF_DYNAMIC_ENCOUNTER_RARITY.md) records persistence, preparation paths, reward and difficulty compatibility. Exact reward formula and high-difficulty set-size behavior remain engineering review items. ChatGPT (GPT-6.2) recorded my decision; no game data, engine or release changed.


## 2026-11-27 — Revised encounter production allocation

Following the regional migration, six Climb conversions and four Find records set aside, my 120-geographic-encounter target remains in place. The revised planning allocation is 73 new encounters from 47 existing: 11 Combat, seven Trick, 22 Aid, 24 Social, four Learn and five Trade, using the current working creative classifications. Individual candidate conversions and classifications are not approved by this allocation; recheck them before final reservation changes. The current Round 1 assignments remain valid. ChatGPT (GPT-6.2) rechecked the current source catalog and reconciled the planning documents. No game data or gameplay changes.


## 2026-11-26 — Eternal Twilight Grove and initial regional expansions

The Eternal Twilight Grove (20127) belongs in my Eldertree Forest rather than Evergrove. Its existing woodland narrative requires no regional rewrite. Eldertree Forest, Frostwind Mountains and Evergrove are my first three new regional expansion catalog entries; Evergrove's content needs a desert-oasis biome review. Planned counts are 22, 9 and 10. Numeric IDs 1005–1007 are proposed subject to collision checks; pricing, activation, rewards and other uncertain placements are not approved. The [regional developer brief](DEVELOPER_BRIEF_REGIONAL_EXPANSIONS.md) hands off implementation. The [Climb developer brief](DEVELOPER_BRIEF_CLIMB_CONVERSIONS.md) requests six candidate revisions and a fresh assessment; exact prose and slot changes require review. ChatGPT (GPT-6.2) synchronized the plans; no runtime or lore files changed.


## 2026-11-26 — Staged encounter production direction

Rather than finishing each family in isolation, my preference is to work across all six encounter chats in successive rounds. ChatGPT (GPT-6.2) proposed three minimum coverage milestones and a rotating work order, audited six Find-to-Climb candidates, and prepared a named regional expansion destination for each of the 79 out-of-Vale expansion-0 encounters. The round allocations and exact regional destinations are working recommendations; individual revisions, new expansion IDs and access migration are not approved by this record. The approved catalog quotas remain unchanged. Documentation only.


## 2026-11-26 — Rare encounter content quota

For my base game, exactly six of the 120 geographic encounters are rare, one per family. Each principal family therefore has 26 ordinary and one rare encounter; Learn and Trade each have five ordinary and one rare. Rarity is independent of difficulty, element and reward quality. This is a content quota, not a 5% encounter draw probability. Individual rare designations and selection mechanics remain unapproved. ChatGPT (GPT-6.2) synchronized the completion plan, production ledger and roadmap; no new rarity field, encounter data, rewards or gameplay changes.


## 2026-11-26 — Equal encounter subtype targets

For my four principal encounter families, the approved production target is nine geographic encounters per subtype: Combat/Purge/Ambush, Find/Open Lock/Climb, Heal/Aid/Nurture, and Speechcraft/Inspiration/Performance. Learn and Trade remain six each. The Trick working baseline requires three new Climb encounters and twelve existing Find candidates to be reviewed for six Open Lock and six Climb revisions. Individual selections, narratives, solutions and reclassifications require separate approval; existing IDs and engraved clues are preserved. The 120 geographic total and 71 active reservations are unchanged. ChatGPT (GPT-6.2) synchronized the plan, ledger and roadmap; no game data or gameplay changes.


## 2026-11-26 — Performance solution category

For my Social encounter family, Performance is approved as the third solution category alongside Speechcraft and Inspiration. Music, dance, storytelling and other artistic expression belong here when the act of performance is the central solution, rather than persuasion or encouragement. The Bard has a natural affinity for these acts without exclusive access. Earthsinger's Challenge (20185) and Melody's Bloomwalker (20186) are candidates for review, not automatically reclassified. The seven reserved Performance drafting tasks are unblocked; the proposed nine-per-subtype split remains subject to approval. Engine support, numeric IDs and migration remain pending. ChatGPT (GPT-6.2) synchronized the completion plan, production ledger and roadmap; no game data or gameplay changes.


## 2026-11-25 — Base-game encounter target

For Ethera's Vale, my approved target is 120 geographic encounters: 27 Combat, 27 Trick, 27 Aid, 27 Social, 6 Learn and 6 Trade. The two scripted sanctuary encounters count toward this total; Atranor and Level Up remain additional universal events. At the current proposed classification baseline of 49 existing encounters, 71 new encounters are required. The family quotas are approved, not every individual reclassification or subtype split. The [completion plan](CONTENT_COMPLETION_PLAN.md) and [production ledger](CONTENT_PRODUCTION_LEDGER.md) now use this target. ChatGPT (GPT-6.2) recorded the decision; no gameplay or data changes.


## 2026-11-25 — Hidden Market location

My approved entrance location for Hidden Market (20012) is western Ethera's Vale, southeast of Lovely Meadows near the western trade road. ChatGPT (GPT-6.2) corrected the CSV and matching generated map entry to [405, 552], with the Vale label. Expansion 0, encounter narrative, solutions and all five Aetherion expansion encounters remain unchanged. The pin does not define the underground layout. Source-level coordinate and boundary checks passed; runtime tests and deployment were not performed.


## 2026-11-25 — Hidden Market base-game scope

The Hidden Market (20012) belongs to my base game, outside Aetherion. Its existing city map placement is a mistake; the five expansion 1004 encounters remain separate. The story describes an underground market reached through a tunnel, without placing it inside the city. ChatGPT (GPT-6.2) proposed a western Vale pin near the west trade road ([405, 552] map units), but the exact entrance and coordinates have not been approved. The [completion plan](CONTENT_COMPLETION_PLAN.md) and [production ledger](CONTENT_PRODUCTION_LEDGER.md) now count 49 existing base-game encounters and 71 new tasks at the provisional target of 120. No map, game data or lore files changed.


## 2026-11-25 — Bard and four-role direction

For my four principal encounter families, the playable roles should have clear, recognizable identities: **Warrior — Combat; Rogue — Trick; Mage — Aid; Bard — Social.** The Mage's magic should lean toward helping, healing and sustaining others rather than being defined primarily by offensive spellcasting. The Bard is my chosen fourth playable role, with a natural affinity for speech, encouragement, music and storytelling.

These affinities describe emphasis, not exclusive encounter access or a new restriction on specialization. Exact abilities, reward pools, mechanical bonuses and specialization restrictions remain to be designed and approved. Performance remains a proposed Social solution category; choosing Bard does not separately approve that category.

The Artisan is an appealing possible later role, not a committed fifth role or part of the current implementation scope. Guardian was considered but is not my choice for the fourth playable role: the familiar identities of Warrior, Rogue, Mage and Bard are clearer. The [existing Guardian philosophy](https://github.com/babunidev/MorkahjaWorld/blob/main/Magic/Elemental_Foundation.md#role-philosophies) remains valid world lore, not a playable-class requirement. The [elemental music tradition](https://github.com/babunidev/MorkahjaWorld/blob/main/Traditions/Elemental_Music.md) provides a foundation for the Bard without requiring a change to canon.

**AI contribution:** ChatGPT (GPT-6.2) reviewed both repositories, compared the existing role solution pools and lore, and proposed alternatives; my creative choice is Bard, with Mage oriented toward Aid. **Status:** design direction approved; documentation only. The current game still has three roles. No implementation, balance testing or deployment.

## 2026-11-25 — Encounter studio taxonomy clarification

For the combined Hunting and Stealth category, my approved name is **Ambush**. It includes tracking, hunting, concealment, surprise and evasion. Help becomes Aid; Travel and Rare Find retire as solution categories, not map travel or item rarity. Performance remains unapproved. The [completion plan](CONTENT_COMPLETION_PLAN.md) and [production ledger](CONTENT_PRODUCTION_LEDGER.md) distinguish creative direction from provisional quotas and unimplemented migrations. No legacy IDs or gameplay changed.


The current project organizes playable client, authoritative server services and shared contracts into one workspace. Browser screens include a credited About Us area with Babuni.dev as author and separate musical contributor credit for Nikita Malko. These are source-observed choices, not a recovered list of acceptance discussions.

Consult the original log at the end of the [development journal](DEVLOG.md) for dated implementation notes. Never reconstruct missing author approvals from a feature's presence alone. AI contributions remain credited separately.

## 2026-11-25 — Ethera's Vale base-game content direction

For the base game, my focus is Ethera's Vale, with other lands isolated for later. Combat, Trick, Aid and Social are the four main families, with Learn and Trade each at roughly 5%. Hunt and Stealth merge; Travel and Rare Find cease to be solution categories. Aid covers Heal, Aid and Nurture; Social covers Speechcraft and Inspiration, with a third category still open. About 5% of geographic encounters are difficulty 2, the remainder difficulty 1; every family has rare encounters. The [content completion plan](CONTENT_COMPLETION_PLAN.md) distinguishes these directions from ChatGPT (GPT-6.2) proposals for exact totals, naming, rarity and individual reclassification. No implementation or release is claimed.

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

## D-022 — The Scribes speak in the game's own voice (2026-11-13)

**Babuni's direction:** after an AI overview of every Scribe (trigger, audience, text) and a list of inconsistencies, "you can rewrite these as well. See what makes sense and how, and that it has the right tone to fit." Player names for account matters and avatar names for game moments stay as they are.

**AI implementation:** support lines in Babuni's first person instead of "the team"/"us"; key reminder in the "your key is your key" wording of D-021; a reader's own entries in the second person, everyone else's (and the admin console) in the third; small fixes (full stop, gem name); texts for never-written Scribe types removed. Triggers and audiences are unchanged.

**Status:** live since 2026-11-13 (release `94cee3ed`, 0.9.0-beta.55).

## D-023 — The lore gem waits on the avatar (2026-11-13)

**Babuni's report and direction:** a lore gem with five rewards "didn't have a slot to go to, so it got kind of stuck in the middle of the encounter image". Instead: "when we pick ... the lore gem, in the lore window, ... it can go on the top left of ... one's avatar", and "when I continue, it goes inside my avatar and disappears."

**AI implementation:** the gem is no longer a result reward. Picking it up notes where it was, the server confirms as before, and a badge on the avatar's top left receives it with a flight from the Lore window; for other party members it fades in. It sinks into the avatar when the room advances or a system event starts, or when the next encounter clears the flag. No server change.

**Status:** live since 2026-11-13 (release `94cee3ed`, 0.9.0-beta.55).

## D-024 — Each hovering solution shows its own roll (2026-11-13)

**Babuni's direction:** "when the difficulty is higher than 1, we want to see the roll of the hovering solution ... of each that is hovering." Report: choosing the same item two or three times, "when it moves into the encounter ... one of them gets replaced."

**AI implementation:** one hovering icon per chosen copy, stacked upward (as in Babuni's original description of sets, "they move up"), each showing its own item; the allocation is frozen at commit; the server adds each pick's roll and the dice-fill roll to the revealed result; the icons show them for 1.3 s before flying in. The rolls stay secret until the commit, like the final roll.

**Status:** live since 2026-11-13 (release `94cee3ed`, 0.9.0-beta.55).

## D-025 — Each solution reveals its roll as it arrives, and stays chosen (2026-11-14)

**Babuni's direction:** use the same font as the roll on the avatar (Breathe Fire); "for each item, the solution animation has to run ... then it goes up and hovers, and at the same time reveals the roll ... when it arrives at its hover position. Then the next ... pushes the other solution up, and when it reaches its position, also the roll is revealed."

**Babuni's choice (asked by AI, because revealed rolls plus "tap to put back" from D-019 would allow retrying until the numbers look good):** "Locked once revealed": a solution is committed the moment it is tapped; no putting back. This replaces D-019's put-back rule.

**AI implementation:** a server endpoint locks each pick and reveals its roll; locked picks persist in the room and the solo checkpoint and decide the final resolution; the client plays the solution animation, raises the solution, and shows the roll on arrival.

**Status:** live since 2026-11-14 (release `151a6e89`, 0.9.0-beta.56).

## D-026 — Makaya's voice follows the reward and the god (2026-11-14)

**Babuni's direction:** taking a reward plays a random line from add item one through three, and picking up a skill plays a random line from add skill one through ten. Losing an essence plays a random line from loose essence one through four. Each god's essence has its own line when it is received. Babuni: the essences will stay the same, so the id can be used. The sound follows the solution id, matched by the god's name.

**AI implementation:** the clips are in `client/public/UI/SFX` and play when the reward or loss is tapped. Ids: 10010 Aeriel, 10011 Aetheria, 10026 Ordius, 10027 Ferrumis, 10036 Umbrael, 10037 Stonara, 10038 Solriel, 10039 Khaotys, 10040 Fyraan, 10122 Nereval, 10123 Sylvanus, 10244 Aerisara. An Atranor item shares the essence inventory and keeps the item line; only solution type 15 uses the loss lines.

**Status:** live since 2026-11-14 (release `83057282`, 0.9.0-beta.58).

## D-027 — Rolls return to a d20 (2026-11-14)

**Babuni's direction:** stop the hidden 1–100 roll. Every lane rolls 1–20. One and two are Misery, three to eight Hardship, nine to twelve Fate, thirteen to eighteen Fortune, and nineteen and twenty Prosperity. A primary solution adds 7 and a secondary solution adds 5. The die adds nothing for now, and that bonus can change later. Difficulty subtracts one less than its level from every roll, including the die: difficulty 1 subtracts 0, 2 subtracts 1, 3 subtracts 2, and 4 subtracts 3. The same step applies where an encounter's difficulty is already 5, 6, or 7. The number on the portrait is the total, so a natural 20 with +7 shows 27, and 26 stays 26. The tooltip names that roll beside the name: `d20`, `d20+7`, `d20+5`, or `d20-1`.

**AI implementation:** `finalizeRoll` in `shared/src/diceInterpreter.ts` adds the bonus and subtracts the penalty, and keeps the total. Nineteen and above is Prosperity, and two and below is Misery. Solution-set copies use the same bonus, and the set's result is their average. An unresolved snapshot still holding a 1–100 number is given a new total when the first solution of a set is locked, or when the choice is committed. A number already on screen that is above 27 is still shown as its old d20 face. Inventory losses on Hardship and Misery are unchanged.

**Status:** live since 2026-11-14 (release `e2aaa790`, 0.9.0-beta.59).

## D-028 — Makaya's lines sit a little under the older sounds (2026-11-14)

**Babuni's direction:** the new voice lines are a little louder than the older effects. The older effects were already lowered on purpose and stay as they are. Even with the sound slider at full, the new lines should come down a little, and they should sit together.

**AI implementation:** Cursor (Grok 4.7) measured the active level of every effect. The older button is about −25 dB. The loudest new lines were about −15 dB, level with the level-up sound, while some skill lines were already near −35 dB. Each new line was moved to about −28 dB, and a peak that still passed the button was limited. The older files were not changed.

**Status:** superseded the same day by D-031. The level-up files shipped in `1073bd45` (0.9.0-beta.63).

## D-029 — The backpack, skillbook and call for help have their own sounds (2026-11-14)

**Babuni's direction:** a backpack sound, a skillbook sound and a call-for-help sound for those buttons.

**AI implementation:** Cursor (Grok 4.7) plays `backpack.mp3` for Inventory, `skillbook.mp3` for Skillbook and `callforhelp.mp3` for Call for help. Lore already had its own sound and keeps it. Call for help was measured at about −11 dB, far above the button at −25 dB, so that file was lowered to about −27 dB. The skillbook spike was held to the button's peak. The backpack already sat with the button.

**Status:** live since 2026-11-14 (release `1073bd45`, 0.9.0-beta.63). The level match (D-031) raises these with the other effects.

## D-030 — The horn reaches five free adventurers, friends first (2026-11-14)

**Babuni's direction:** sounding the horn chooses up to five online players who are in the dashboard or another menu, and not in a room. Friends are preferred, so five free friends are the five who hear it. Each receives a Scribes line and a notice at the top. The notice plays the call-for-help sound, only while they are on the dashboard, and only once a minute. A full group disables the button, and the tooltip says why.

**AI implementation:** Cursor (Grok 4.7). The Scribes line and the top notice were already sent to the chosen player. The choice is now capped at five, friends first, still skipping anyone whose presence is in a room. The horn plays with the dashboard notice and waits sixty seconds before it can play again. Three engaged adventurers dim Call for help, with the tooltip "The group is full."

**Status:** live since 2026-11-14 (release `1073bd45`, 0.9.0-beta.63).

## D-031 — Every effect sits with the level-up sound (2026-11-14)

**Babuni's direction:** the sounds were still very different from one another. The solution opening was very low, and some reward lines, especially the essences, were quite loud. The dice felt right, and then the ask was that every sound, the dice included, sit on one level with the level-up sound.

**AI implementation:** Cursor (Grok 4.7) measured the loudest brief moment of each effect. The level-up sound is about −4 dB there and was left unchanged. The other effects were raised toward −8 dB, which is the body of that fanfare, and a peak that would have passed full scale was held down. This replaces the D-028 target of sitting under the button. The d20 release had already taken D-027, so these sound decisions continue from D-028.

**Status:** live since 2026-11-14 (release `1073bd45`, 0.9.0-beta.63).

## D-040 — A die in a set shows its roll, then flies in (2026-11-15)

**Babuni's direction:** when an encounter needs more than one solution, the first die hovers without its result. A normal solution shows its result. The die should behave the same way, and it should also disappear into the encounter as the solutions do.

**AI implementation:** Cursor (Grok 4.7). Each press asks the server for that die's face, the same face the result will use. The number appears when the die arrives at its hover place. When the result shows, those dice fly into the encounter with the solutions. A reload keeps the revealed faces.

**Status:** released as 0.9.0-beta.74, 2026-11-15. The face rule, the room path and the Atranor reset are tested. A played turn was not watched before release. The same day, those revealed dice were still on the participant when Atranor opened, so they hovered again. Atranor and a level-up now drop them. Solution stacks were still coming back with them; that is D-041.

## D-041 — An Atranor item is spent, and the previous stack does not return (2026-11-15)

**Babuni's direction:** using a resurrection item in Atranor brings the life back, and that is right, but the item has to be consumed the way a solution is consumed in every other encounter. The solution stacks from the encounter that just ended were also still there, on Atranor and on a level-up. Those stacks should disappear when they fly into the encounter, and a system event must not call them back.

**AI implementation:** Cursor (Grok 4.7). Atranor keeps the solutions the roll used and spends those charges before the essence reward is granted. The dice still spends nothing. When the hovering set takes off into the encounter, the stack is cleared. Atranor and a level-up do not restore a stack locked on the encounter that just ended.

**Status:** released as 0.9.0-beta.75, 2026-11-15, from `a6865336`. The room path passed, including an Atranor Elixir that is gone after a successful return. A played turn was not watched before release. The live script is `index-CKrypy23.js`.

## D-039 — A new land crossfades (2026-11-15)

**Babuni's direction:** switching expansion should crossfade. The new weather fades in while the old weather fades out. The sound should always fade in.

**AI implementation:** Cursor (Grok 4.7). A land change starts the new stage A at the same moment the old piece starts falling. The rise is one second and the fall is two. A land that starts from silence still fades in over one second. A land with no recordings, or leaving the encounter, still fades the bed out. The fades inside one land are unchanged.

**Status:** released as 0.9.0-beta.74, 2026-11-15. The overlap is tested. A land change was not heard before release.

## D-038 — A total of 25 grants one more normal item (2026-11-15)

**Babuni's direction:** rolling a 25 gives one extra reward, a random normal item. When the encounter already grants five rewards, a sixth item is not added. One of those five gains two charges instead. A level-up cannot reach 25.

**AI implementation:** Cursor (Grok 4.7). The finished total is the one on the result. On 25, and only on a normal encounter, one item of reward type 2 is added, skipping items already in the reward. At five encounter rewards the list is left as it is and one of them is granted with two extra charges. The prosperity essence is unchanged.

**Status:** released as 0.9.0-beta.74, 2026-11-15. The rule is tested. A 25 was not played before release. Superseded by D-054 (2026-11-23): a 25 no longer adds an item.

## D-037 — Each die in a set rises after its spin (2026-11-15)

**Babuni's direction:** in an encounter that needs more than one solution, the dice was not behaving like the other solutions. It should move up after its animation, hover, and wait. Rolling it again should push the earlier die up.

**AI implementation:** Cursor (Grok 4.7). One press fills one missing place. The spin plays on the button, then a copy of the die rises and hovers above the slot. The next press does the same and pushes the earlier die up. Solutions already chosen keep their places. The set resolves when the places are full, and each die is still its own roll. An encounter that needs one solution is unchanged. A die hovered in an unfinished set is not stored on the server, so a reload in the middle keeps the locked solutions and loses the hovering dice.

**Status:** released as 0.9.0-beta.73, 2026-11-15, from `c9d6d144`. The client tests passed, including the step rule, and the production client build typechecked. The rise was not watched in a played turn. The gold glow on a hovering die or solution was removed the same day, after Babuni saw it on the live game. The second die in that picture is not rotated; the glow's square made it look tipped. The stack was also tipping left once the rolls showed, because the slot used its entrance pose. Both corrections, and the extra item on a 25, went out as 0.9.0-beta.74.

## D-036 — The dice and a solution last 1.73 seconds (2026-11-15)

**Babuni's direction:** the dice spin and the solution wiggle were different lengths, and a solution's roll arrived after the wiggle had stopped. Both base animations last 1.73 seconds, and the roll is committed when that animation ends. The rise after a set pick, the wait after the last roll, and the hover bob stay as they were.

**AI implementation:** Cursor (Grok 4.7). The dice spin, the solution wiggle, and the wait until each roll is committed are 1730 ms. A clickable Scribes notice no longer keeps the browser's gray button face. The local start script is on this line. This had been written against an older checkout and had not reached main.

**Status:** released with 0.9.0-beta.72, 2026-11-15. Not watched in a played turn.

## D-035 — Each gap is its own roll (2026-11-15)

**Babuni's direction:** difficulty 2 means two separate instances. Two usable keys are two rolls. The same item with two charges still plays the animation each time: it rises and hovers. With no solution, the dice is rolled twice.

**AI implementation:** Cursor (Grok 4.7). Each solution pick still locks, animates, and hovers on its own, and a second charge of the same slot starts that animation again. Each gap the dice fills now has its own face and its own spin, instead of one face counted again. Snapshots stored before this repeat their one die. The average is unchanged as the outcome.

**Status:** released as 0.9.0-beta.68, 2026-11-15, from `dccf8797`. Not played through in a browser.

## D-034 — The portrait result shows the roll and its modifiers (2026-11-15)

**Babuni's direction:** the result above the portrait shows the solution and the number. The tooltip should grow at the bottom, in the same frame, and show how that number was made: the roll, then the modifiers.

**AI implementation:** Cursor (Grok 4.7). A second frame under the existing tooltip shows the d20 face, then `+` the solution bonus and `−` the difficulty penalty. A primary solution is +7, a secondary is +5, and the die is +0. A set lists each part the same way. An old 1–100 number is left without a made-up face.

**Status:** released with 0.9.0-beta.68, 2026-11-15. Not hovered in a played turn.

## D-033 — Stay in the region most of the time (2026-11-15)

**Babuni's direction:** encounters in a pool stay equally likely. The next one should usually be from the same expansion, including expansion 0, so a stretch of the journey stays in one region. A written follow still happens. When there is none, roll a d20: 1–14 stay, 15–20 switch expansion. Ambient tracks are a separate project.

**AI implementation:** Cursor (Grok 4.7). The room advance, the continue after a normal encounter, the encounter after a level-up or Atranor, and a newly opened room all use that roll. The region after a system encounter is the encounter that led there. The preloaded next picture uses the same roll from the encounter about to be played. A follow is still taken only on a successful Fortune or Prosperity, and opening a room still jumps to a follow written on the last encounter. The draw that checked expansion again after the pool was already filtered is removed. D-032 is the weather bed, so the region is D-033.

**Status:** released with 0.9.0-beta.68, 2026-11-15. Not played through in a browser.

## D-032 — A weather bed beside the encounter music (2026-11-15)

**Babuni's direction:** the encounter music rests 7–21 seconds. A third player, Ambiance, runs four stages in every expansion. Stage A plays 3–7 pieces, then a 20 percent chance of stage B. Stage B plays 1–7, then an even chance of stage A or stage C. Stage C is one piece, and an 80 percent chance fades into stage D; otherwise it returns to stage B. Stage D plays 2–4 pieces that fade into each other, then an even chance of stage B or stage A. The bed follows the encounter's expansion, keeps going while that expansion stays the same, and fades when a newly loaded encounter belongs to a different expansion. The recordings are given in one folder. The game sorts them into an expansion folder and a stage folder, at one loudness. Expansion 0 is the base game. Every piece fades in over one second and out over two. The bed has its own settings slider, starting at full, because it was too quiet under the music. Using a solution plays one of eight new lines. All effects sit at nine tenths of the effects slider, and the solution lines and the reward lines sit at nine tenths of that.

**AI implementation:** Cursor (Grok 4.7). The dashboard rest stays 6–14 seconds. Expansion 0 and expansion 1 were copied into `client/public/UI/Ambiance/` and leveled to about −38 LUFS. `11nature` was read as further stage A for expansion 1, and `1wind` as further stage B, because those names collided with files already numbered in those stages. A land with no folder fades the bed out. The current encounter list uses expansions 0, 1001, 1003 and 1004, so the expansion 1 bed plays only when an encounter's expansion field is 1. On this branch the decision was first written as D-021; main already uses D-021 for the terms, so the release records it as D-032. The local beta numbers 59–67 collided with releases already live, so the release is 0.9.0-beta.64.

**Status:** implemented for release as 0.9.0-beta.64. The stage rules were tested. A full cycle was not heard.

**Later the same night:** Roarback Mauler is Keldor, and Keldor is expansion 1. The encounter stores that land as 1001, and the recordings are filed as 1, so the bed was looking for a folder that does not exist and staying silent. A named land now plays the folder at its place: 1001 plays 1. Urcogor, Everwinter and Aetherion still have no recordings. Shipped 2026-11-15 inside 0.9.0-beta.68. A full cycle was still not heard on the live game.

**Later:** the edited recordings for Urcogor Ravage, expansion 1002, cover all four stages. They are filed as expansion 2: 16 in stage A, 16 in B, 12 in C and 13 in D. The game copies were brought to about −38 LUFS. The edited files in the drop folder were left as given. Everwinter and Aetherion still have no recordings.

**Corrected the same night:** those recordings belong to Everwinter Valley, expansion 1003. The drop-folder names are `3stage`, and the game copies live in folder 3. Urcogor has none. Aetherion still has none.

**And Aetherion:** the city, expansion 1004, now has its own four stages, filed as expansion 4: 12 in A, 16 in B, 12 in C and 12 in D. The game copies were brought to about −38 LUFS. The edited files in the drop folder were left as given. Urcogor is the land still without recordings. Released 2026-11-15 as 0.9.0-beta.72. A full cycle was still not heard on the live game.

## 2026-11-13 — Licensing decision

To make the reuse terms explicit, I approved MIT for original software and CC BY 4.0 for eligible original creative material, excluding commissioned music and externally sourced sound assets. This applies only to material for which the relevant rights can be granted; third-party contributors keep their own credits and licenses. AI assistance committed the license notice and updated project-facing documentation. This was a legal/documentation change, not a runtime feature or test.

## D-042 — Complete the encounter prose revision (2026-11-16)

For the remaining encounters, I approved the cinematic, present-tense style already used in the game, with varied length and paragraph rhythm, observable details, and no assumed player decisions or outcomes. The source shows that the earlier revision reaches `20052`, Nagar Elder. Those passages remain the reference for the continuation. The instruction includes committing directly to `main` without a new branch.

Codex (GPT-6; exact model variant not recorded) drafted and reviewed the 140 remaining descriptions and corrected one stray word in `20025`. The game data and existing lore remain authoritative; this is a prose revision, not approval for new mechanics or replacement world canon. See the [scope and verification record](ENCOUNTER_REVISION.md). Publication to GitHub is separate from deployment; no production release is claimed.

## D-043 — Region plate, title on arrival, one weather cycle (2026-11-17)

**Babuni's direction:** a small field on the top edge of the encounter, half over the picture and half over the frame, shows only the region: Ethera's Vale for expansion 0, otherwise the expansion's title. Title font, gold on the dark red, framed like the encounter; the frame's lines go up 45°, straight and down 45° around it, and below it down 45°, across and up 45°. Slim, but wide enough for the name. When an encounter loads, its name fades in for 1.3 s, stays 0.7 s and fades out over 1.3 s, so the picture can be enjoyed. The ambiance stage cycle must not reset to stage A when the region changes. Later the same day: the shortest break between pieces drops to 0 s for both music and ambiance, and every piece always fades in over 1 s and out over 2 s (first set to 1 s out, changed to 2 s before release). Babuni also set the chance from stage A to stage B to 50% (D-032 had 20%), and every stage, the approach included, to 1–4 pieces before the roll (D-032 had 3–7, 1–7, 1 and 2–4). Babuni asked for a fitting Morkahja mouse cursor; the gold arrow with a ruby and its clickable variant are an AI-made design that Babuni can replace with their own artwork. Babuni also approved routing sound through Web Audio on iPhone and iPad so those fades work there; it is used only where the browser ignores element volume.

**AI implementation:** Claude Code (Claude Opus 5.5). "Ethera's Vale" (spelled as in the game data, e.g. the Aetherion text and item descriptions) is a client constant because the base game has no catalog entry; catalog names are shown in title case ("The cursed forest of Keldor" reads "The Cursed Forest of Keldor"). A piece cut off by a new land counts as played. If the new land lacked the next stage, it would start at A; every land with recordings has all four.

**Status:** released 2026-11-17 as 0.9.0-beta.76 (`83801ca8`).

## D-044 — A drawn world map behind the region plate (2026-11-17)

**Babuni's direction:** clicking the region plate covers the encounter picture with a world map, like Lore or the inventory, filling the frame and opened on the current place; it can be dragged like an online map. Gold ground, drawn in the red; straight angled lines only, no curves and no right angles; line styles from the frame (full with broken, thin full with broken, three or four lines); triangles as the only symbols. Geography from Babuni's notes, checked against the MorkahjaWorld archive, which takes precedence where it is more specific.

**AI implementation:** Claude Code (Claude Opus 5.5). Placements, sources and the drawing choices made where neither source gives a direction are listed in [WORLD_MAP.md](WORLD_MAP.md). Spellings follow the archive: Ethera's Vale, Celesterra, Ohgar, Karrhu, Eldertree, Deepstone Hollow. Wheel and pinch zoom were added to the requested dragging. Babuni's follow-ups the same day: the marker has four triangles overlapping its ring and pointing inward, and Celesterra is labelled "Aevis homeland", not a sky-city. Babuni then supplied a placement list for all 203 encounters (`docs/data/encounter_locations.csv`); the marker follows it. The list's pixels were measured on the zoomed-out map; the conversion (0.444 px per map unit, offset 16, -14) is the fit that puts 194 of 195 placed points inside the land the list names; points within 12 units of a border were nudged inward (19), Aetherion's six sit on the city.

**Status:** released 2026-11-17 as 0.9.0-beta.76 (`83801ca8`).

**Later on 2026-11-17 (D-044):** Babuni asked for the plate to show the encounter's own land from the placement list, because each land is meant to become its own expansion and the base game already tells stories from several of them. Atranor shows its own name; the level-up keeps the land already shown. Released 2026-11-17 as 0.9.0-beta.77.

## D-045 — A spent slot refills from another item of the same kind (2026-11-17)

**Babuni's direction:** in a set (difficulty 3: three solutions), when the item in a slot has only one charge, it grays out after use even though the inventory holds other items of the same kind. "When I have more of the same type, I should be able to refill the slot", so several items of the same kind can solve one encounter, not only the ones shown at the start.

**AI implementation:** Claude Code (Claude Opus 5.5). `allocateSolutionSet` keeps spending the slot's own item while it has charges, then takes another item of the slot's alternative type (the encounter's secondary type), lowest id first, never one shown in another slot. Each refill uses the alternative lane's rolls, one per copy. Picks are appended in order, so locked picks keep their item and revealed roll. The slot shows the item it will take next. This replaces D-019's rule that a different item is not substituted.

**Status:** released 2026-11-17 as 0.9.0-beta.77 (`885f2b41`).

## D-046 — A single die shows its roll, then flies into the encounter (2026-11-17)

**Babuni's direction:** with one solution needed, a solution rolls and flies into the encounter, but the dice "just disappears". "We throw our luck inside the encounter", so the die should behave exactly like a solution, and stop a moment, about 0.7 seconds, showing its result first.

**AI implementation:** Claude Code (Claude Opus 5.5). When the result appears, the die and its number are held over the dice button for 0.7 s (the same pause sets use before going in), then the die flies into the picture with the solutions' flight; rewards emerge after it. Sets keep D-040's behaviour.

**Status:** released 2026-11-17 as 0.9.0-beta.77 (`885f2b41`).

## D-047 — An encounter waits for three others before it returns (2026-11-17)

**Babuni's direction:** the same encounter must not come right after itself; "after it was there, it has to wait at least … 3 encounters to repeat on number 4".

**AI implementation:** Claude Code (Claude Opus 5.5). The room remembers its last three random encounters; the draw leaves them out while anything else is available in the chosen land (`ENCOUNTER_REPEAT_GAP = 3`). The 85% chance to stay in the land (D-033) is unchanged. Written follow-ups, Atranor and the level-up are not draws and are exempt. A new room starts with the avatar's last encounter, and the solo checkpoint keeps the list. Babuni's first sentence said "before 4 other encounters"; the implementation follows the later, specific wording (three others, back on the fourth at the earliest). The gap is one number to change.

**Status:** released 2026-11-17 as 0.9.0-beta.77 (`885f2b41`).

## D-048 — Rooms nobody can return to are removed (2026-11-18)

**Babuni's direction:** abandoned rooms are "just leaving trash behind"; when everyone has left, close the room and delete it. Babuni agreed to Claude Code's three suggestions: delete a room when it closes, clean up the leftovers once, and keep a living avatar's paused solo room, but only for 30 days without anyone looking at it.

**AI implementation:** Claude Code (Claude Opus 5.5). Saving a room as `closed` now deletes its row, in and outside transactions (`setEncounterRoom` in `postgresDocumentStore.ts`), so every path that closes a room removes it. `sweepAbandonedRooms` deletes rooms stored as closed by older releases, open rooms in which no participant has a living avatar (dead, missing or none; a failed avatar that may still be sacrificed for counts as living), solo rooms whose avatar is in a newer open room (only the newest can be returned to; these pile up when a helper is left alone in someone's room after the caller leaves), and open rooms untouched for 30 days (`ABANDONED_ROOM_DAYS`). The server runs it at start and every six hours and logs what it removed. A paused solo room of a living avatar stays within the 30 days, because it holds the adventure the player returns to (so leaving cannot swap a bad encounter for a new one). After 30 days the player starts a fresh encounter. The solo checkpoint already treats a missing room like a closed one.

**Counted before release** on the backup of 18 Nov 01:36 UTC (285 room rows), with the sweep in count-only mode: 220 closed, 0 without a living avatar, 16 superseded (Sylvaen 9, Thalyss 7; no human player), 30 untouched for 30 days (last used June to September). 19 rooms stay.

**Status:** released 2026-11-18 02:37 UTC (`52952f0e`); the first sweep removed 266 rooms as counted.

## D-049 — A level-up lets the player choose one of three rewards (2026-11-18)

**Babuni's direction:** besides the rolled rewards, a level-up offers "a roguelike choice for 3 rewards". The player rolls first, then sees three random rewards, can hover them on a computer or long-press them on a phone to compare their tooltips, and picks one; the pick joins the rolled rewards where the rewards appear. The d20 is divided into four: each 5 adds one rolled reward, so below 5 only the chosen one, up to 4 rolled plus the chosen one with a 20. The bots choose automatically, so they also get the full rewards. Babuni's answers to Claude Code's questions: the three choices come from the avatar's race and role reward types; the rolled rewards alternate race and role as before; a roll of 20 adds the rare type-15 item as the fourth; the choices sit in the solution bar.

**AI implementation:** Claude Code (Claude Opus 5.5). Rolled rewards: `floor(roll / 5)`, at most 4 (1–4 none, 5–9 one, 10–14 two, 15–19 three, 20 four): race; race + role; two race + role; and on a 20 a type-15 item (all twelve are essences, as in the old top tier; another role reward if none exists). The three choices are different race or role rewards, avoiding the rolled ones while enough others exist; they are drawn when the level-up encounter is created and stored in its snapshot (`levelUpChoiceIds`), like the rolled rewards, so a reload cannot redraw them. After the roll the prepared result offers them; `POST /room/level-up/choice` prepares the result again with the pick, and Continue is refused until a pick is made (`LEVEL_UP_CHOICE_REQUIRED`). The prepared commit always holds one choice, the first option until the player picks, so a player who leaves a shared room before choosing still gets one; stepping away (a reload, a paused solo room) keeps the choice open for the return. Client: the choices fade into the bar once the die has flown into the encounter, under "Choose your reward"; hover or long press shows the usual tooltip, a tap picks; the rolled rewards and the pick then grow out of the encounter as usual. Bots pick one of the three at random. The old outcome tiers (Misery … Prosperity) no longer decide level-up rewards.

**Changed the same night (Babuni's direction):** no roll first. The three choices appear at once in place of the die; the one the player picks moves to the middle of the bar and bounces while it rolls, shows the roll, and stays as the first reward while the rolled ones grow out around it. `POST /room/level-up/choice` now also works before the roll and makes the roll itself; the roll-then-choose path stays for a level-up already rolled. The snapshot DTO carries `levelUpChoiceIds`. Bots pick before the roll too. Together with this, the roll on the avatar changed for every encounter: the solution's image is gone and the number stands big in the middle of the portrait; the used solution and the roll's parts are sections in the avatar's own tooltip (on party members the big number keeps its own tooltip, as their portraits have none).

**Status:** released 2026-11-18 in 0.9.0-beta.78.

## D-050 — Nobody is marked inactive in a room (2026-11-19)

**Babuni's direction:** there are no features that flag, tag or mark a player as inactive or disconnected in a room. The responsibility lies with the players: anyone can leave a room at any time, start another one or return to their own. Multiplayer should feel smoother while staying light on the server.

**AI implementation:** Claude Code (Claude Opus 5.5). The idle-kick system switched off on 1 June 2026 is removed (`ROOM_INACTIVITY_ENABLED`, `INACTIVITY_MS`, `disconnectedAt`, re-engaging after inactivity); only a fallen avatar is left out of a party. Room updates reach the screen through one waiting request instead of a 3 s (or 0.25 s) poll: `GET /room/active?wait=…` answers when the room changes, or after 25 s.

**Open for Babuni:** Lore, Inventory and the Skillbook still pause a party's advance while open (from June), and a player who closes the tab without choosing stays listed until they leave. Both are consistent with this decision, since nobody is flagged, but either can hold the others.

**Status:** released 2026-11-19 in 0.9.0-beta.79.

## D-051 — Frameless circular solution artwork (2026-11-21)

**Babuni's decision:** Rework the game's solution illustrations one by one, keeping the original solution ID, name, description, current appearance, and relevant MorkahjaWorld canon as the starting point. Physical items receive a continuous circular background and must remain entirely within it; skills and abilities instead depict their effect or concept across the circular area. All icons are frameless, with transparency outside the disc, intended to combine with game-rendered frames later. The circle may use the full 512 × 512 canvas. Close-ups and more abstract interpretations are welcome when faithful to the solution.

**Export direction:** 512 × 512 WebP, targeting roughly 0.077 MB when the image quality allows. Check actual dimensions, transparency and file size; don't enforce a byte count at the cost of readability.

**Process and authority:** Preserve original assets until replacements are reviewed, inspect the game solution data and artwork first, and consult the MorkahjaWorld repository when lore is relevant. The [artwork standard](SOLUTION_IMAGE_STANDARD.md) is the durable rule and review checklist. **Status:** visual direction approved; repository documentation committed. The first replacement, 10001 Arcane Intellect, is a draft rather than an approved, committed, tested or deployed game asset.

**AI contribution:** ChatGPT (GPT-6) inspected the game solution metadata and existing image and the MorkahjaWorld Common Arts and Elemental Foundation texts, then documented the standard. No gameplay code or production artwork changed as part of the documentation commit.

## D-052 — A solution's frame is part of the UI, on top of every picture (2026-11-21)

**Babuni's direction:** solution pictures are being remade without a painted frame. The frame belongs to the UI, not to the item graphics: every solution item is two parts, the picture with the solution inside, and the frame that sits on top. Every item gets it, in the language of the encounter frame made round. An essence's frame carries its god's element; valuable items get a richer frame.

**AI implementation:** Claude Code (Claude Opus 5.5). `SolutionImage` (React) and `createSolutionPictureElement` (plain DOM, for pictures in flight) draw the picture clipped round and an SVG frame over it, everywhere a solution picture appears. Pictures not yet remade are zoomed (1.12× since the same day, after 1.3× cut items off) so most of their painted rim falls under the frame; remade ones are shown whole; since the same day (Babuni: "fix that") the solution record marks them with `mSolutionIconFrameless: true`, which Babuni Admin sets on upload.

**Charges (same day, Babuni's direction):** each picture shows the charges the player holds in a small hexagon at its bottom right, in the inventory and on the solutions offered in an encounter, so the count needs no tooltip.

**Open for Babuni:** which items count as rare (proposed: the Atranor items, non-essences kept with the essences, icons named legendary or epic).

**Status:** released 2026-11-21 in 0.9.0-beta.80.

## D-053 — An avatar's own element: starting essences, faster loss of others, a bonus essence (2026-11-21)

**Babuni's direction:** avatars start with essences of their own gods, of their own element. Essences of other elements are lost faster: a loss always takes two of them. The exception is when only one essence of another element is left: then a loss of one takes just that one, and the next loss takes an essence of the avatar's own element at the normal rate; a loss of two in that case takes the last other one and one of the avatar's own. A finished total of 25 or higher has a 20% chance to grant one extra essence of the avatar's own element. Asked to settle two readings, Babuni chose "25 or higher" (so a 25 brings both the extra item of D-038 and this chance) and "other elements first": essences of other elements are always lost before the avatar's own.

**Elements:** the races' elements come from the world-building archive (`Magic/Magic_Corruption.md` and the race arts): Rokur fire, Verdani water, Aevis air, Grimnir earth. Each element has three gods' essences, by the pantheon's tribunals, the same table the essence frames already used (now `shared/src/essenceElements.ts`).

**AI implementation:** Claude Code (Claude Opus 5.5). Starting inventory (`buildInitialAvatarSeedIds`): the three essences are drawn from the avatar's own element only, so each new avatar gets its three gods. Losses (`consumeEssenceLossesState`, used by Hardship and Misery through `applyFailurePenaltyToInventoryState`): per essence loss, two other-element charges while two or more are left, the last one alone, then one own-element charge; essences without an element in the table count as the avatar's own. Bonus (`server/src/engine/ownElementEssenceBonus.ts`): on a successful normal encounter with a total of 25 or more, one chance in five adds a random essence of the avatar's element to the rewards, after the prosperity essence and a 25's item. Existing avatars keep their inventories; only the loss rule and the bonus apply to them.

**Status:** released 2026-11-21 in 0.9.0-beta.82. Server tests pass, including new ones for each rule; a new Rokur and Verdani got their elements' essences locally; losses and the bonus not yet played. The bonus changed in D-054 (2026-11-23): certain on 24 or higher.

## D-054 — Balance pass: lower roll bonuses, a rare item's +1, an own essence on 24 or higher (2026-11-23)

**Babuni's direction:** the game is a little too easy. The primary slot goes from +7 to +5, and every secondary solution from +5 to +2; the dice stays as it is. Every rare item adds +1 to every roll made with it. A total of 24 or 25 brings one extra essence of the avatar's own element, on top of the encounter's reward, and the reward the 25 gave before is removed. Asked by Claude Code, Babuni chose: the essence comes every time, not by chance; a 26 (possible now with a rare primary item) counts too, so the rule is "24 or higher"; the rare items are the ones with the rare frame.

**AI implementation:** Claude Code (Claude Opus 5.5). The slot bonuses are the shared constants. Rarity is one shared rule (`shared/src/solutionRarity.ts`) used by the frame and the resolver: the Atranor items, the Frostbane Glaive, the Zephyrstring Lyre and the Titanpike, never essences. The +1 is added when a pick's roll is read, so the revealed roll and the final total agree; the stored totals keep only the slot bonus. The own essence is certain on a successful normal encounter at 24 or more. It supersedes the extra item on a 25 (D-038) and the one-in-five chance (D-053).

**Status:** released 2026-11-24 in 0.9.0-beta.83. Server and client tests, typecheck and build pass; not played.

## D-055 — Atranor returns with the gods of the avatar's own element (2026-11-23)

**Babuni's direction:** an essence gained in Atranor comes from the avatar's own element's gods. A 7 gives one of them, a 14 the second as well, a 20 the third as well. Using an Atranor item always gives all three. Asked by Claude Code, Babuni chose: 7 or more survives (it was 9); an Atranor item still rolls to survive; one charge per essence; the gem sacrifice gives all three.

**AI implementation:** Claude Code (Claude Opus 5.5). One shared rule by the total, used by the server's survival, death and reward paths and by the client's result bar. The essences are different gods, drawn in random order; an avatar without an element gets different essences of any element.

**Status:** released 2026-11-24 in 0.9.0-beta.83. Tests and typecheck pass; not played.

## D-056 — Player choices: equipment, specialization, avatar edit, travel (2026-11-23)

**Babuni's direction:** give an avatar identity and the player more choice and less randomness, with no chance outside the dice and every solution still fitting its encounter. Four choices, worked out in discussion with Claude Code and settled the same day; the full rules are in [PLAYER_CHOICES.md](PLAYER_CHOICES.md).

- **Equipment:** two different items (not skills, essences or Atranor items). Equipping adds one extra charge, always spent first. A use with a total of 12 or higher gives one charge back, 20 or higher two; each use in a set counts by its own roll. Hardship and Misery cannot take equipped charges. No unequip: swapping costs the item that leaves one charge, and one on its last charge disappears. Equipped in the avatar selection, or in the game once the choice in the encounter is made. The regain shows on the item, not among the rewards.
- **Specialization:** one skill type (fifteen, without Life and Resurrection), +1 to every roll with a skill of that type in any slot. Chosen and changed only in the avatar selection; the first choice is free, a change costs 1 gem.
- **Edit:** portrait (same race, role and gender), frame and name; race, role and gender are locked. Only what changes is paid: the portrait's or frame's gem value, 50 gems for a name.
- **Travel:** a region is its expansion. A trip costs a tenth of the expansion's gem price, rounded (Keldor 8, Everwinter 5, Aetherion 3), and the base game 1. It swaps the current encounter, at any time and through chains, with no reward or loss for the one left; never from Atranor or a level-up. Afterwards the usual follow and region roll apply. A host takes the room along; a guest who travels leaves. Locked regions are red on the map and lead to the Expansions menu.
- **Bots** have neither equipment nor specialization; dead avatars are not in the selection.

Babuni rejected Claude Code's proposals of a chance to save a charge and of using an equipped item in any slot.

**AI contribution:** Claude Code (Claude Opus 5.5) read the current slot, bonus, charge, solution-type, gem, expansion and map data, asked the open questions, worked out the regain thresholds and drafted the fifteen specialization descriptions for Babuni to revise.

**Status:** decided. Equipment implemented on 2026-11-23, released 2026-11-24 in 0.9.0-beta.83; its swap rule and the wait for the choice were replaced the same day by D-057. The selection modes were replaced by the avatar overview (D-057, D-058). Specialization implemented the same day in that overview (released 2026-11-24 in 0.9.0-beta.83). On 2026-11-24 Babuni corrected the list: type 25 is Aid (it holds the Warmth skill), and type 37, which no skill uses, is no longer a specialization. Edit avatar implemented on 2026-11-24, opened by an Edit button under the portrait in the main menu's card (released 2026-11-24 in 0.9.0-beta.83). Travel implemented on 2026-11-24 on the world map (released 2026-11-24 in 0.9.0-beta.83); Claude Code limited it to before anyone in the room has chosen, so an outcome already known cannot be escaped. Babuni confirmed travel the same day and added a wait of three encounters after each trip.

## D-057 — One avatar card, opened by a tap; equipment only into empty slots (2026-11-23)

**Babuni's direction:** the avatar has no hover tooltip any more. A tap on the avatar opens one card, in the game and in the avatar selection: name, level, race and role, the experience bar and how much experience; a spacer; the two equipment slots under an Equipment title with a "?" that explains equipment; after a roll, the names of everything used and the roll's math. In the game, the Home button is at the bottom of the card; in the avatar selection, the green check that starts the game. The card anchors like the inventory tooltips: from the left avatar by its bottom-left corner, from the middle one by the middle, from the right one by its bottom-right corner. The separate Equipment buttons and the equipment popup are removed. Equipment rule changed: an item can only go into an **empty** slot, at any time, also outside the game where the room's encounter does not matter; a full slot stays until its item breaks. A full slot shows the item's tooltip on hover or a long press, and a tap does nothing. The game prefers the equipped item in the solution slots. A tutorial with tips at the start of a player's journey goes on the roadmap.

**AI implementation:** Claude Code (Claude Opus 5.5). The details card (`AvatarPartyDetailsCard`) holds everything and is shown in an `AnchoredGamePopover` in both places, measured against the whole screen in the selection so it opens toward the middle. A tap outside closes it in the selection. The equipped item is preferred by the shared slot rule (`slotFaces`, `allocateSolutionSet`, `refillFor`), so the server and the slot pictures agree. The server refuses a full slot (`SLOT_OCCUPIED`) and no longer refuses while choosing; a change after the choice still goes into the prepared outcome. This replaces D-056's swap rule and its "once the choice is made" rule.

**Status:** released 2026-11-24 in 0.9.0-beta.83. Checked in the local game on desktop and phone.

## D-058 — The avatars are the main menu; an avatar overview (2026-11-23)

**Babuni's direction:** no Play button. The active avatar, the one played last, is big in the middle where Play was; the other two sit under it, left and right, like a triangle. A tap on one of them makes it the active one, with a quick swap. A tap on the active avatar opens its overview, the size of the avatar creation, with everything about the avatar: who it is, experience, statistics (items, encounters played and the like), the two equipment slots without any Equipment button, and space for the specialization later. The red button goes back, as in the avatar creation; the green one enters the game, the card closing smoothly into the big avatar before the transition. The same overview opens in the game. With no avatar, the slots are empty as before. Equipment slots are the same size as the other solutions and the Inventory pictures.

**Second round (Babuni, same day):** the overview is framed like an encounter, with the same behaviour on phone and desktop; no back button, a tap outside closes it; the in-game panels (Inventory, Skillbook, Lore, overview) try the dark red background instead of the parchment picture.

**AI implementation:** Claude Code (Claude Opus 5.5). The active avatar is remembered in the browser, falling back to the last played. In the game the overview lies over the encounter picture like the Inventory, so its slots match the inventory size, and keeps Home with the red back button; it leaves out the portrait and repeats the name only on the plate. Statistics: encounters played (from the progression, added to `GET /avatars`) and the item, skill and essence charges.

**Status:** released 2026-11-24 in 0.9.0-beta.83. Checked in the local game on desktop and phone; coming home from the game not checked.

## D-059 — Tips and tutorial can be turned off; no text smaller than the tooltips (2026-11-23)

**Babuni's direction:** every "?" help in the game (and the tutorial's tips to come) can be turned on and off with one check mark, "Tips and tutorial", in the settings. Explanations belong in the "?" tooltips, not as text on the card: the avatar overview's specialization section shows only its heading with a "?", the chosen name and the button. The help tooltips are as readable as the item and skill tooltips, and no text in these screens is smaller than those tooltips. Prices in gems show as "Cost 1" with the red-yellow gem icon. In the main menu the overview's green check sits at the bottom right.

**AI implementation:** Claude Code (Claude Opus 5.5). `client/src/ui/tips.ts` keeps the setting in the browser (`morkahja.tips.enabled`, on unless turned off) and tells open screens when it changes; `HelpTip` (`client/src/ui/common/HelpTip.tsx`) is the one "?" with its tooltip and hides itself when tips are off; `GemCost` draws the price. The overview and the specialization picker use the item tooltip's font size (`gameTooltipFrameStyle`) as their smallest.

**Status:** released 2026-11-24 in 0.9.0-beta.83. Checked in the local game on desktop and phone.


## D-060 — The top roll rewards a red-yellow gem (2026-11-24)

**Babuni's direction:** every roll that reaches the highest possible total earns one red-yellow gem. Today that total is 26; when the bonuses change, the number changes with them. The gem is rewarded like the lore gem and shows in the same place on the avatar. With the lore gem as well, a small 2 in the items' hexagon stands next to the gem.

**AI implementation:** Claude Code (Claude Opus 5.5). `TOP_ROLL_TOTAL` (26) and `isTopRoll` in `shared/src/diceInterpreter.ts`; a test ties the number to the d20, the primary bonus and the +1 of a rare item or a specialized skill (the two never meet on one roll, because no skill is rare). The server grants the gem with the roll's commit in all three places a roll is committed (the round, leaving mid-round, and a system event such as Atranor or the level-up), with its own claim key per player and roll, so it never pays twice and stands apart from the lore gem. The client shows it on the avatar's gem badge from the moment the avatar shows the roll; the badge counts both gems and uses the item hexagon (`SolutionChargeBadge`) for the 2.

**Status:** released 2026-11-24 in 0.9.0-beta.83.

## D-061 — Accept and Back are word buttons (2026-11-24)

**Babuni's direction:** everywhere in the game the green check becomes a normal red-and-gold button with the word **Accept**, and the red round picture a matching button with the word **Back**.

**AI implementation:** Claude Code (Claude Opus 5.5). `client/src/ui/common/WordButton.tsx` (`AcceptButton`, `BackButton`, built on `PanelButton`, so they press and glow like the other buttons) replaces `im_button_yes.webp` and `im_button_delete.webp` in the avatar creation and edit (and its gem question), the specialization picker (and its gem question) and the travel question. The pictures stay in `client/public` but are no longer used.

**Status:** released 2026-11-24 in 0.9.0-beta.83. Checked in the local game on desktop and phone.

## D-062 — Soul links pay when both play 42 encounters a day; a QR invite (2026-11-24)

**Babuni's direction:** a soul link only counts when the new player has played 42 encounters, and only when the soul-linked player also played 42 encounters that day; it counts once a day. The Soul Link window shows a QR code; whoever starts the game from it is connected to the one who showed it, and the soul link is made as soon as they are logged in. Also decided the same day: the Inventory, Skillbook and Lore keep the dark red background; the solution frames and the world map placements stay as they are; Urcogor (expansion 1002) does not exist yet and its weather recordings are future work.

**AI implementation:** Claude Code (Claude Opus 5.5). `soulLinkGift.ts` pays the one-time Gift of the Gods on the first UTC day both have 42 encounters, at most one gift per soul-linked player per day. `soulLinkInvite.tsx` and the QR code in `SoulLinkOverlay.tsx` link the newcomer after login, and the server makes the friendship mutual for an invite.

**Status:** released 2026-11-24 in 0.9.0-beta.83. Server test and local browser check passed; the QR code was not scanned with a real phone.

## D-063 — The base game is Ethera's Vale; ten regional expansions, closed (2026-11-26)

**Babuni's direction:** the [regional migration brief](DEVELOPER_BRIEF_REGIONAL_EXPANSIONS.md) and the [manifest](CONTENT_EXPANSION_ASSIGNMENTS.md), prepared with ChatGPT (GPT-6.2): the base game is Ethera's Vale plus Atranor and Level up; the 79 out-of-Vale encounters go to named regional expansions, none accessible before approval, existing entitlements protected; Eternal Twilight Grove belongs to Eldertree Forest; 20009 is not silently given to Everwinter; no prices, rewards, art or activation.

**AI implementation:** Claude Code (Claude Opus 5.5), with these choices of its own, open to Babuni's correction: IDs 1005–1014 as proposed (free at the check); catalog entries without any shop fields and with `mExtensioListed: false`, so the Expansions menu does not show them; an expansion must be active as well as unlocked for its encounters to be drawn; 20009 held in expansion 0 by a list in `encounterAvailability.ts` rather than given a land; the grove's point at [490, 854]; every map land except the Vale mapped to its expansion, so travel to the ten lands is closed until they open. Details and the Evergrove recommendations: [report](REPORT_REGIONAL_EXPANSIONS_2026-11-26.md).

**Status:** released 2026-11-26 in 0.9.0-beta.84. Release check and local browser check passed.

## D-064 — Placements decided, regions coming soon with gem prices, bundles own every expansion (2026-11-26)

**Babuni's direction:** accept the Evergrove recommendations of the [D-063 report](REPORT_REGIONAL_EXPANSIONS_2026-11-26.md); the Grimnir Vault (20009) goes to Celesterra, the Grimnir homeland, with its text fitted; the Climb Round 1 drafts are approved, and not everything has to be in the picture; set gem prices from the lands' sizes against Aetherion (small), Everwinter (medium) and Keldor (big), with a rough number of encounters for each; list the regions as not available yet, with artwork if possible and no money price for now; whoever buys a bundle gets every expansion, also those added later.

**Size tiers (Claude Code's reading of the map, open to Babuni's correction):** land areas on the world map in map units: Evergrove 54k, Celesterra 53k, Everwinter 52k, Karrhu 48k, Keldor 45k, Ohgar 40k, Eldertree 35k, Rocky Tundra 35k, Fyrskar 34k, Frostwind 33k, Emberfrost 31k, Shattered Peaks 15k. Big (45k and more, as Keldor): 75 gems, about 40 encounters — Evergrove, Celesterra, Karrhu. Medium (25k–45k): 50 gems, about 20 — Eldertree (already 27), Frostwind, Emberfrost, Fyrskar, Ohgar, Rocky Tundra. Small: 25 gems, about 10 — Shattered Peaks. Everwinter would be big by area but stays as it is. Fyrskar, the Rokur homeland, is medium by area while the Verdani and Aevis homelands are big; that is a choice for Babuni.

**AI implementation:** Claude Code (Claude Opus 5.5): the moves and new map points; the vault's two changed sentences; the Round 1 data edit; shop texts from the world archive; banners cropped from one encounter painting of each land (stand-ins, not new artwork); the bundle mark `allExpansions` with a start-up top-up.

**Status:** released 2026-11-26 in 0.9.0-beta.84. Release check and local browser check passed. Climb Round 2 drafted, awaiting approval.

## D-065 — Homecoming: the homelands are earned by playing their people (2026-11-26)

**Babuni's direction:** Evergrove (Verdani), Celesterra (Aevis and Grimnir) and the Fyrskar Mountains (Rokur) are unlocked by an achievement, not bought: 100 encounters with one avatar open its people's homeland, a one-time, early unlock. A visible achievement with three ranks. Existing avatars count, and progress counts from now. Homelands cannot be bought with gems; only the complete package, which is not offered yet, will include them. Bundle buyers own everything. The other seven regions stay gem-bought as in D-064.

**AI implementation:** Claude Code (Claude Opus 5.5): the `homecoming` chain and its titles (Rootseeker — renamed from Homecoming the same day at Babuni's request, since a rank title is worn by the avatar — Hearthfriend, Child of Morkahja; the panel's bar shows the best avatar's encounters toward 100 from the first encounter), the homeland list in the catalog (`mExtensioHomelandOf`), the check after each encounter and at start-up, the refused gem unlock, and the shop and panel texts. Its own choices: the unused monthly-reward glyph as icon; each rank adds 1 gem to the Hearth Blessing like the other chains;  the homelands keep their gem price only for the travel cost.

**Status:** released 2026-11-26 in 0.9.0-beta.84. Server test against PostgreSQL and the release check passed. The same day, at Babuni's request, the three homelands were switched on so that an earned homeland can be played and travelled to right away; the other seven regions stay coming soon.

## D-066 — Six Find encounters set aside; letter encounters stay; regions decided (2026-11-26)

**Babuni's direction:** the base game has too many Find encounters. Six are set aside at random in an inactive expansion with a high number, so they are never chosen and can return when the base game grows. Every encounter with a letter clue stays in the base game. The Fey Greens sanctuary is Verdani work. The regional placements are decided and no longer under review.

**AI implementation:** Claude Code (Claude Opus 5.5): expansion 1999 "Set aside" (inactive, unlisted); a seeded random draw (`morkahja-set-aside-2026-11-26`) among the seven letterless Find encounters chose 20001, 20002, 20003, 20069, 20072, 20111. The manifest and the placement list now record each region as decided.

**Status:** released 2026-11-26 in 0.9.0-beta.84. This replaces the brief's six Find-to-Open-Lock conversions as the way to reduce Find; Open Lock stays at 3 unless Babuni asks for conversions.

**Addendum (same day):** the letter clues spell MORKAHJA and the R was missing; at Babuni's direction 20090 Ethereal Glades, the one letterless Find encounter left in the base game, now carries a carved R. All eight letters are in the base game.

**Addendum (same day, Babuni):** Find should be nine, so 20001 and 20002 came back to the base game (seeded draw); four stay set aside (20003, 20069, 20072, 20111). Lands without their own weather recordings play the Vale's for now. After the Homecoming achievement, each opened homeland gets its own notification.

## D-067 — Specializations only for held skill types; a free change per new type (2026-11-26)

**Decided by:** Babuni. **Implemented by:** Claude Code (Claude Opus 5.5).

- A specialization can be chosen only for a type of skill the avatar holds (with a charge left). Its current one stays even when those skills run out.
- Each skill type the avatar holds for the first time gives one free change; free changes add up. The first choice stays free; a change without a free one costs 1 gem (D-056).
- Existing avatars start counting from what they hold on the day this shipped.
- Open: "a new one" is implemented as a new type of skill, not every new skill.

## D-068 — Six essence charges, the Soul Link welcome gift, Alpha Player told (2026-11-26)

**Decided by:** Babuni. **Implemented by:** Claude Code (Claude Opus 5.5).

- The game is too hard: a new avatar starts with two charges of each of its three own gods' essences (six in all), and every Atranor return gives two charges per god: 2 at a total of 7, 4 at 14, 6 at 20, with an Atranor item or a gem sacrifice. Existing avatars keep what they hold.
- The Soul Link window gets a **Share** button for the direct link (the phone's share menu, otherwise the link is copied), a list of the souls linked to you, and today's progress toward the gift.
- A newcomer who comes through a Soul Link receives **Aetherion** as a welcome gift. It opens on the gift day (both play 42 encounters on one day, D-062), not at linking, so a second account cannot take it for free. Already owned: nothing extra.
- Every unlock of a single expansion (gems, a purchase, Homecoming, the welcome gift) shows the expansion's card in the dashboard: a red LOCKED band fades, a green UNLOCKED band pops in and fades, the text and previews can be read, and **Proceed** closes it. Bundles show no card.
- A delivered soul link also gives the inviter **5 Alpha Player points**, besides Spiritguide. Alpha Player shows from the start while its places are open, with a "?" (under the Tips setting) that says how it is earned and how many of the 100 Legendborn places are left. The 80 gems a day at Legendborn stay: Babuni accepts them for players who bring others in.
- The daily support message becomes a pool of two (support, Soul Link), shown in the dashboard only, never during an encounter.
- Defaults chosen by the AI when Babuni said "go ahead" without picking: 5 Alpha points per link, nothing extra when Aetherion is owned, the whole pool dashboard-only, existing avatars unchanged. Babuni can revise any of them.
