# Ethera's Vale — staged content production

**Creative:** Babuni · 00 Management · 2026-11-26

Rather than finishing entire families in isolation, my preference is to develop them together in small rounds. The following sequencing is a management recommendation based on the approved quotas and the pinned 49-record working baseline; individual encounter revisions and rare/difficulty designations still require approval.

## Round targets and work

**Reassessment (2026-11-27):** the 47-existing / 73-new planning baseline supersedes the earlier totals below. Six Climb conversions are implemented and released. Keep current Round 1 new assignments (13 total); no additional Climb conversions are needed. The resulting geographic count is 60, conditional on completing those assignments. Round 2/3 figures and affected Combat/Trick tasks below are historical pending reconciliation of individual classifications and Open Lock decisions. See [current management reassessment](CONTENT_COMPLETION_PLAN.md#2026-11-27--management-reassessment).


Each round is a minimum coverage milestone, not a demand to reduce subcategories already above it. First review each family's existing records before relying on its working counts; after that, alternate chats and draft one encounter at a time, including associated solutions. Management may direct the earliest unfinished task within the current round even if a lower reserved ID belongs to a later round. No parallel writes to the same data file; recheck main before each commit.

| Round | Minimum per principal subtype | Learn/Trade each | New | Trick conversions | Geographic total after round |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 2 | 13 | 3 Climb | 62 |
| 2 | 6 | 4 | 26 | 3 Climb + 3 Open Lock | 88 |
| 3 | 9 | 6 | 32 | 3 Open Lock | 120 |

Within each round, rotate 04 Social → 03 Aid → 01 Combat → 02 Trick → 06 Trade → 05 Learn, skipping a chat only when its round tasks and applicable reviews are done. Do not finish an entire family's final quota before moving to another. Review existing candidates early, particularly the two provisional Performance records and the Trick conversions. Use the ledger for actual draft/approval/commit/verification status.

| Chat | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| 04 Social | 20232–20233 Speechcraft; 20240–20242 Inspiration; 20249 Performance | 20234–20236 Speechcraft; 20243–20245 Inspiration; 20250–20252 Performance | 20237–20239 Speechcraft; 20246–20248 Inspiration; 20253–20255 Performance |
| 03 Aid | 20210–20211 Heal; 20218 Aid; 20225 Nurture | 20212–20214 Heal; 20219–20221 Aid; 20226–20228 Nurture | 20215–20217 Heal; 20222–20224 Aid; 20229–20231 Nurture |
| 01 Combat | 20194–20195 Purge | 20196–20198 Purge; 20202 Ambush | 20199–20201 Purge; 20203–20205 Ambush; 20206 Combat |
| 02 Trick | Three Climb conversions (below) | Three additional Climb and three Open Lock conversions | Three additional Open Lock conversions; 20207–20209 Climb |
| 06 Trade | 20260 Trade | 20261–20262 Trade | 20263–20264 Trade |
| 05 Learn | Review two existing, no new task | 20256–20257 Learn | 20258–20259 Learn |

## Find-to-Climb audit

All 21 working Find records and their associated primary solutions were reviewed at pinned main c16640cd against [Vale landmarks](https://github.com/babunidev/MorkahjaWorld/blob/main/Places/Vale_Landmarks.md). Six are plausible conversion candidates; none currently presents a sufficiently explicit vertical challenge to justify a metadata-only reclassification. Preserve the landscape, focal identity and any clues; introduce an actual vertical obstacle with a reason to ascend or descend. No individual revision approved yet.

| Priority | ID | Encounter | Proposed vertical situation | Existing primary (preserve shared identity; review references) |
| --- | ---: | --- | --- | --- |
| Round 1 | 20068 | Fey Greens | Reach upper ledges on the existing sanctuary rock; do not damage sacred architecture or contradict refuge lore. | 10080 Whistle Reed |
| Round 1 | 20005 | Seraphic Plains | Reach a recess high on one immense weathered pillar using existing cracks; original purpose remains unknown. | 10009 Seraphic Map |
| Round 1 | 20004 | Mystic Grass | Scramble the rocky mound below the summit pillar; require a genuine ascent, not walking up a gentle hill. | 10008 Mystic Map |
| Round 2 | 20080 | Dreamy Valley | Descend or climb the immense boulders to reach the sheltered passage; preserve the existing passage and review the lyre's distinct gateway purpose. | 10086 Dreamy Lyre |
| Round 2 | 20071 | Arcane Meadows | Reach a higher branch or ledge above the shaded hollow; the current low branch is not enough. | 10083 Whistle of Harmony |
| Round 2 | 20088 | Mesmerizing Hillsides | Introduce a short exposed ascent within the existing two-hill hollow; avoid turning the gentle landscape into a mountain. | 10098 Mesmerizing Windchime |

The last three require stronger narrative revision than the first three. None uses the seven engraved-letter scenes (A, H, K, J, O, M, A). Six Open Lock conversions remain to be individually researched and approved; Radiant Heath (20087), with its existing quill/secret-door tradition, is a strong candidate but its engraved M must remain. Dreamy Valley is also a plausible alternative Open Lock candidate if its Climb revision does not fit; do not assign it twice.

Use implemented Climb skill/item types 13/14, e.g. Climb (10070), Climbing Gear (10071), Acrobatic Climb (10068), Seeker's Grapnel (10211) or Faewoven Ladder (10167), where the complete record fits. Replace mismatched primary references only after reviewing all references; do not retag maps or musical relics blindly, or remove player-owned solutions. Review image suitability separately. If a proposed candidate fails review, revise the allocation before creating replacement content.

## Developer handoff

Use the [Find-to-Climb developer brief](DEVELOPER_BRIEF_CLIMB_CONVERSIONS.md) for the six candidates, beginning with the three Round 1 scenes. Return exact text and slot proposals for reassessment. Do not count unapproved revisions as complete.

## End-of-round checks

Check family/subtype totals, existing review status, unique IDs, primary/fallback pairs, geography, element diversity and artwork dependencies. Track rare and D2 slots independently; the final catalog has six of each. Do not mark text ready as engine-ready. Performance and other taxonomy changes, out-of-Vale access isolation and deployment remain separate engineering tasks.

ChatGPT (GPT-6.2) calculated the stages, audited Find narratives and existing Climb solutions, and drafted this sequencing recommendation. No encounter or solution JSON, game engine, lore or assets changed.
