# Developer brief — Regional expansion migration

**Creative:** Babuni  
**Date:** 2026-11-26  
**Status:** Approved direction; implementation pending. No release approval.

## Objective and boundaries

My new base game is Ethera's Vale (expansion 0) plus Atranor and Level Up. Preserve every out-of-Vale encounter, assign it to a named regional expansion, and create real catalog entries for Eldertree Forest, Frostwind Mountains and Evergrove first. Future regions must remain inaccessible until approved; existing expansion entitlements are protected.

Read both repositories' AGENTS.md and docs/DOCUMENTATION.md, the [completion plan](CONTENT_COMPLETION_PLAN.md), [79-ID manifest](CONTENT_EXPANSION_ASSIGNMENTS.md) and relevant lore. Recheck latest main and local changes; audit pinned 0f8fdc4f.

| Region | Proposed ID | Records | Treatment |
| --- | ---: | ---: | --- |
| Eldertree Forest | 1005 | 22 | Actual catalog entry, inactive until release approval |
| Frostwind Mountains | 1006 | 9 | Actual catalog entry, inactive until release approval |
| Evergrove | 1007 | 10 | Actual catalog entry; biome review before activation |
| Emberfrost | 1008 | 7 | Future inactive destination |
| Celesterra | 1009 | 7 | Future inactive destination |
| Fyrskar Mountains | 1010 | 7 | Future inactive destination |
| Shattered Peaks | 1011 | 5 | Future inactive destination |
| Desert of Ohgar | 1012 | 4 | Future inactive destination |
| Swamp of Karrhu | 1013 | 6 | Future inactive destination |
| Rocky Tundra | 1014 | 1 | Future inactive destination |
| Everwinter Valley | 1003 | 1 | Existing active expansion; hold 20009 pending boundary and entitlement review |
| Total | | 79 | |

IDs 1005–1014 were unused in pinned catalogs; recheck before allocation. Existing 1001 Keldor, 1002 Urcogor Ravage (inactive event), 1003 Everwinter and 1004 Aetherion must retain their definitions and existing entitlements. No new pricing, rewards, unlock benefits, imagery or public activation approved. Create inactive schema-valid entries; if mandatory commercial fields require decisions, report blockers instead of inventing values. Other future destinations need valid inactive records or explicit safe isolation until final assignments are approved. Do not leave unresolved out-of-Vale records eligible in expansion 0 or create dangling expansion IDs.

## Approved relocation: 20127 Eternal Twilight Grove

Move from current expansion 0/Evergrove map label to Eldertree Forest, proposed expansion 1005. Choose an interior map point and report coordinates/boundary check; precise placement is unspecified. Synchronize CSV and generated encounter map entry. Preserve existing narrative, title, image, solution slots, difficulty, reward and element: the haunted woodland has no Evergrove reference. Update world archive Places/Eternal_Twilight_Grove.md and Places/Eldertree_Forest.md to reflect approved parent region and link the grove, preserving spirits/music tradition; document canon update separately. No other relocation follows automatically from this choice.

## Evergrove review (ten remaining candidates)

Use [Evergrove canon](https://github.com/babunidev/MorkahjaWorld/blob/main/Places/Evergrove.md): dunes, salt flats, wind-cut mesas, cultivated oasis-gardens, hydromantic canals, sandstone and living Nexus roots. Lush refuges are possible; generic temperate forest is not the default.

| ID | Encounter | Review direction |
| --- | --- | --- |
| 20010 | Verdani Casket | Between Eldertree and Evergrove explicitly; review wooded transition and boundary. |
| 20016 | Ailing Verdani | Could fit cultivated oasis refuge; current moss/fern clearing needs context. |
| 20021 | Blightwraith Huntress | Generic dying woodland; check creature canon, relocation versus threatened oasis. |
| 20024 | Blightwraith Rootrot | Wet forest decay; review origin and nexus root sickness before retaining. |
| 20029 | Blightwraith Occultist | Corrupted woodland; review individually, not automatic family relocation. |
| 20033 | Wild Bloodfang | Forest boar/mud/undergrowth; review habitat, likely relocation candidate unless supported. |
| 20053 | Exhausted Verdani | Explicitly Evergrove edge; assess transition or oasis framing. |
| 20064 | Altar of Umbrael | Canon explicitly Evergrove; retain cave and review its surroundings. |
| 20125 | Raided Verdani Village | Canon Evergrove; preserve elder tree/survivors, review canal and architecture context. |
| 20191 | Slumbering Ogru | Willow could grow near cultivated water; region unspecified, review lore/art. |

Return retain/rewrite/relocate recommendation for each, with lore and artwork evidence. No blanket desert reskin or unapproved rewrite. Coordinate creative approval.

## Engineering requirements

- Update server/game/encountersdata.json and server/game/expansiondata.json together using the manifest. Preserve IDs, text except separately approved revisions, rewards, difficulty, solutions, images, follow links and inventory ownership.
- Update docs/data/encounter_locations.csv and client/src/ui/game/worldMap/encounterLocations.ts together; update REGION_EXPANSIONS and EXPANSION_FOCUS in worldMapData.ts. Other regions currently default to expansion 0 on the map. Locked destinations must not enter a base-game travel pool. Preserve Aetherion's site.
- Audit server/src/services/encounterGenerator.ts, unlock/commerce APIs, direct travel, forced follows, room/prepared encounters and persisted snapshots. Random eligibility uses unlocked IDs; forced follows bypass filter and direct travel selects by expansion ID. Prevent locked-content leaks without invalidating legitimate historical snapshots or entitlements.
- Review ExpansionsOverlay.tsx, encounterExpansion.ts, client asset/audio fallbacks, inactive visibility and pricing/unlock flows. No invented commercial values or permanent unrelated regional assets.
- Resolve interpretive map conflicts using manifest notes; 20009 Deepstone Hollow is near Everwinter, not necessarily inside it, so do not silently grant it to existing active expansion 1003. Preserve uncertain encounters in safe isolation rather than deleting them.

## Acceptance

Pinned catalog: 203 records = 49 base geographic (47 random and two scripted), 2 universal, 79 out-of-Vale, 73 existing nonzero-expansion. None of the 79 had incoming/outgoing written follows at audit; recheck latest. After migration/staging all 79 must be excluded from new base-game draws; preserve established 73 assignments and sanctuary links. Report actual counts if concurrent work changes baseline.

Run npm run verify:static-data, npm run typecheck, npm test and npm run release:check as applicable; add focused selection, travel, follow, unlock and map tests for entitled and unentitled players. Return exact file diff, per-region counts/IDs, manifest reconciliation, Evergrove review, blockers, assets and actual test results to 00 Management. Use reviewable commits and documentation; no deployment or activation without separate approval.

Prepared by ChatGPT (GPT-6.2) from Babuni's direction.
