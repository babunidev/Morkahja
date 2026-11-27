# Developer brief — Dynamic encounter rarity

**Creative:** Babuni  
**Date:** 2026-11-27  
**Status:** Approved design direction; engineering implementation pending. No release approval.

## Objective

Every geographic encounter in my game can appear in its rare form. A single independent server-owned rarity roll of 1 in 20, when that encounter appearance is prepared, determines whether its effective difficulty increases by one. The rare appearance has a greater reward and a distinct encounter frame. It is not a new encounter record, and does not change story, family, subtype, element, map placement, primary item or solution identities.

| Appearance | Chance | Effective difficulty |
| --- | ---: | --- |
| Normal | 95% | Authored base difficulty |
| Rare | 5% | Authored base difficulty + 1 |

Atranor (1) and Level Up (2) are excluded as universal system events. Apply the rule to geographic encounters in all expansions, including scripted geographic follows. Excluded/locked content remains excluded. Do not change regional selection weights, entitlement checks or existing item rarity. A fixed roll result such as d20 = 20 is a suggested implementation, not a change to the player's action dice.

## 1. Normalize authored base-game difficulty

In server/game/encountersdata.json, all expansion-0 geographic records use mEncounterDifficulty = 1. At audit commit dbd1a8f819970d629965680089a504164f2ec500, 45 random geographic records already have D1; Nerevals Sanctuary 19001 and Hearthguard Sanctuary 19444 have D2. Change only the two difficulties; keep all other fields and written follow links (20192 -> 19001, 20188 -> 19444). Do not alter Atranor or Level Up. All new Vale records use D1. Preserve all nonzero-expansion records' base difficulty, including set-aside records. No extra rare encounter or solution IDs; no fixed rarity quota.

## 2. One persisted rarity decision per appearance

Read both repositories' AGENTS.md and documentation standards, and current game source. In server/src/services/encounterGenerator.ts, prepareNextEncounter presently returns a selected ID and mode; the actual next geographic draw can be selected again at resolution. Establish the authoritative preparation boundary at the committed choice of the actual next encounter, not an unused preview or discarded candidate. Cover initial play, ordinary random continuation, explicit travel, geographic follows, room lineage, solo/multiplayer and bots. Roll exactly once after the encounter identity is selected and before action rolls/reward calculation. A genuinely new appearance of the same ID gets an independent roll.

Store immutable appearance rarity, effective difficulty and effective reward information with the authoritative prepared/active snapshot and room lineage as applicable (server/src/types/encounter.ts, encounterSnapshot.ts, persistence and client contracts). Do not mutate shared static records. Prevent reload/reconnect, retries, room joining, participant creation, restarts or retries of commits from rerolling or duplicating rewards. Every participant in a shared appearance sees the same rarity and difficulty; retain existing participant-specific reward and roll semantics. Do not retrofit rarity into already-prepared/active legacy encounters; use a compatible non-rare interpretation of existing snapshots, preserving their original difficulty and rewards. Check system-event interruptions and follow-ups.

## 3. Difficulty and reward compatibility

- Use the effective difficulty consistently for action rolls, penalties, solution sets, dice-fill rolls, essence costs, failures, rewards and client-visible state. Preserve normal encounter behavior.
- Important existing mismatch: server/src/engine/types.ts declares EncounterDifficulty 1|2|3|4; shared/src/solutionSet.ts caps sets at four, and encounterRollGenerator.ts creates extra rolls using that cap. Current catalog nevertheless includes D5, D6, D7, so the approved +1 rule can produce D8. Audit data readers, roll formulas, set-size and UI limits, loss multipliers, persistence and reward paths. Do not silently clamp the effective difficulty or invent a new high-difficulty set-size rule. Preserve existing behavior where supported; report any required design decision before changing set semantics.
- Existing reward paths already scale some reward uses with effective difficulty (inventoryService.ts scaledUses); random reward IDs are sampled using mEncounterRewardAmount. Verify that every rare success has a meaningfully increased reward under existing rules; propose the smallest compatible adjustment where necessary. Exact extra reward amount, reward type and any additional bonus are not specified. Do not double-apply scaling, grant rewards on failure, change outcome tables or promise a particular multiplier without approval. Return the proposed formula with normal/rare examples and evidence.

## 4. Frame presentation

Expose server-authoritative rarity and effective difficulty to the client and make rare appearances visually distinguishable before the first action (existing encounter frame/EncounterImageBlock.tsx and relevant room state). Show the rare status explicitly, not just color. Retain the normal encounter artwork and all existing solution/item rarity presentation. Exact frame art/styling is not specified; propose a minimal indicator for review. No unrelated UI redesign.

## 5. Acceptance

Test deterministic RNG boundaries (one result in 20 is rare), repeated genuine appearances, independent rarity vs action dice, normal and rare D1, D2, existing D4 and D7, both sanctuary follows, system exclusions, unlocked and inactive expansions, room participants, reconnect/resume, retries, legacy active snapshots, and no duplicate or changed rewards for normal encounters. Verify the rare indicator and difficulty/reward behavior on desktop and phone. Confirm all geographic Vale records are authored D1 and all other base difficulties unchanged. Run npm run verify:static-data, npm run typecheck, npm test and npm run release:check where appropriate. Return actual commands, results, unresolved compatibility issues and proposed reward/frame specifics. Protect player data and entitlements. Update documentation and changelog/devlog; no deployment without separate authorization.

Prepared by ChatGPT (GPT-6.2) from Babuni's direction and the pinned current source. No implementation or runtime testing performed in the encounter studio.
