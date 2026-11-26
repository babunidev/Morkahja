# Developer brief — Find-to-Climb conversions

**Creative:** Babuni  
**Date:** 2026-11-26  
**Status:** Candidate revisions for review. Round 1 drafts returned 2026-11-26 ([CLIMB_CONVERSIONS_ROUND_1.md](CLIMB_CONVERSIONS_ROUND_1.md)); no data changed. No taxonomy-wide migration or deployment.

## Objective

My Trick family should contain nine Find, nine Open Lock and nine Climb encounters. Working audit: 21 Find, three Open Lock, zero Climb (including proposed reclassifications). Reuse six existing Find scenes where landscape and identity allow. Start with the strongest three, then return a fresh assessment before the remaining three.

Read both repositories' AGENTS.md and docs/DOCUMENTATION.md, [production rounds](CONTENT_PRODUCTION_ROUNDS.md), [ledger](CONTENT_PRODUCTION_LEDGER.md), Vale landmarks and relevant relic lore; reread full encounter/solution records at latest main. Audit pinned 0f8fdc4f.

| Round | ID | Encounter | Proposed vertical opportunity | Existing primary |
| --- | ---: | --- | --- | --- |
| 1 | 20068 | Fey Greens | Reach upper sanctuary-rock ledge; preserve faun workmanship, deer and peaceful refuge. No damage to sacred structure. | 10080 Whistle Reed |
| 1 | 20005 | Seraphic Plains | Reach high recess in immense weathered pillar; preserve resonance and unknown purpose. | 10009 Seraphic Map |
| 1 | 20004 | Mystic Grass | Scramble rocky mound below summit pillar; genuine ascent, not walking uphill. | 10008 Mystic Map |
| 2 | 20080 | Dreamy Valley | Ascend/descend between boulders to sheltered passage; preserve flowers and lyre identity; report if better Open Lock. | 10086 Dreamy Lyre |
| 2 | 20071 | Arcane Meadows | Reach elevated branch/ledge over hollow; preserve northeastern Vale and branch movement. | 10083 Whistle of Harmony |
| 2 | 20088 | Mesmerizing Hillsides | Short exposed ascent within hollow; retain gentle slopes, small creature and changing light. | 10098 Mesmerizing Windchime |

None supports metadata-only conversion. The seven engraved-letter scenes (A, H, K, J, O, M, A) are outside this set.

## Draft and implementation

Prepare revised present-tense narratives with perceivable vertical obstacle and meaningful purpose; invisible narrator, no prescribed action or resolution. Keep title, setting, image reference, difficulty 1, element, expansion 0 and reward unless separately approved. Return prose and proposed slots for approval before data edits.

Implemented classification is Trick mEncounterType 2, mEncounterSubtype Climb, ClimbSkill 13, ClimbItem 14. All six have a B primary item and C Find skill fallback 5; Fey Greens also has obsolete B fallback 20. A proposed matching pattern: B primary = fitting existing Climb item ID, B fallback = 14, C primary = 0, C fallback = 13, other unused slots unchanged. Validate current engine semantics. Existing solutions include Climbing Gear 10071, Seeker's Grapnel 10211, Faewoven Ladder 10167, Climb 10070, Acrobatic Climb 10068, and race-specific Climb skills. Review descriptions and choose by fit, not invented effects. One primary item maximum.

Each old primary is referenced by its corresponding encounter alone in pinned encounter JSON, but may be player-owned or rewardable. Preserve solution identities, IDs, names, types, uses, rewards and inventory. Replace primary references only after approval; never retag/delete maps or instruments blindly. Any new solution must use Chat 02 reserved range 10312–10375 after collision check and approval. Check scripts/assign-encounter-element-subtype.mjs so inference does not overwrite reviewed manual classifications. Preserve all other encounters and clue letters. Review artwork suitability separately.

## Reassessment and acceptance

Return exact revised prose, old/new slot values, canon rationale, image implications and verification per candidate; coordinate Chat 02 before edits. First three are Round 1; remaining three Round 2. Individual final revisions need creative approval. Update ledger after actual commits, not drafts.

| Stage (working audit) | Find | Open Lock | Climb | Total |
| --- | ---: | ---: | ---: | ---: |
| Before | 21 | 3 | 0 | 24 |
| First three Climb conversions | 18 | 3 | 3 | 24 |
| All six Climb conversions (before Open Lock work) | 15 | 3 | 6 | 24 |
| Six separately approved Open Lock conversions | 9 | 9 | 6 | 24 |
| Three new Climb (20207–20209) | 9 | 9 | 9 | 27 |

Counts are conditional on current working reclassifications. If a candidate fails creative/lore/artwork fit, report and adjust allocations rather than forcing it. No new encounter IDs consumed by revisions. Run npm run verify:static-data, relevant encounter/solution tests, npm run typecheck and npm test as appropriate; verify IDs, references, slot types, unchanged records and primary limit. Report actual results, update plan, ledger, decision and changelog/devlog, no deployment.

Prepared by ChatGPT (GPT-6.2) from Babuni's direction.
