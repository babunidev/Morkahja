# Base game content completion plan — Ethera's Vale

**Creative:** Babuni  
**Status:** Creative direction recorded 2026-11-25; implementation pending. Ambush is approved; numerical target, Performance and individual reclassifications remain proposals. See the [shared production ledger](CONTENT_PRODUCTION_LEDGER.md).

## Scope and design direction

For the new base game, my focus is Ethera's Vale alone. Other lands and their encounters are to be isolated for later expansion work, not rewritten or deleted. Combat, Trick, Aid and Social are the four principal families; Learn and Trade remain separate, smaller foundational families at roughly 5% each. Approximately 5% of geographic encounters should be difficulty 2 and all others difficulty 1. Every family should have rare encounters. Atranor and Level Up remain universal system events, outside these quotas.

## Role direction

The [approved four-role direction](DECISIONS.md#2026-11-25--bard-and-four-role-direction) aligns Warrior with Combat, Rogue with Trick, Mage with Aid and the future Bard with Social. These are thematic strengths, not exclusive solution access or encounter selection rules. Mage abilities should lean toward assistance and restoration; Bard abilities will be designed separately. Learn and Trade remain independent families available across roles. Artisan is a possible later role, not part of this content phase. Performance, exact role abilities, reward changes and specialization restrictions still require separate approval. The quotas, existing encounter IDs and reservations are unchanged.

## Proposed taxonomy

| Family | Solution categories | Existing IDs / work |
| --- | --- | --- |
| Combat | Combat, Purge, Ambush (approved merger of Hunting + Stealth) | 9/10, 27/28, merge 29/30 and 35/36 |
| Trick | Find, Open Lock, Climb | 5/6, 7/8, 13/14 |
| Aid | Heal, Aid, Nurture | 21/22, 25/26, 33/34 |
| Social | Speechcraft, Inspiration, Performance (proposed third category) | 17/18, 39/40, new pair only after approval |
| Learn | Learn | 1/2 |
| Trade | Trade | 3/4 |

Ambush is the approved name for the merged Hunting and Stealth category; do not reopen it. Performance means music, dance, storytelling and other expressive acts, distinct from persuasion (Speechcraft) and encouragement (Inspiration). It is not implemented. Keep existing Learn and Trade IDs 4 and 5, retain encounter ID 3 for Aid (formerly Help), and propose ID 6 for Social. No travel or rare-find solution category remains in the target taxonomy; map travel remains a separate mechanic. Rarity is orthogonal to family, solution type and difficulty. The existing RareItem type 32 is not the same as an encounter rarity field. Do not remove item rarity or its roll bonus. Existing legacy IDs must be migrated safely, not reused blindly.

## Audit and target

Source snapshot: [4c72b414](https://github.com/babunidev/Morkahja/commit/4c72b41491d45d4da0bcfd5c8c0473c9f26d1d23). Counts derived from the complete encounter JSON joined to world-map labels; map placement can be interpretive, not immutable canon. The Hidden Market (20012) has Aetherion label but vale polygon and no explicit location in prose; hold provisionally pending decision. Canon places Aetherion inside the Vale, but five other Aetherion-labelled encounters are gated by expansion 1004. Keep those expansion records intact; the decision concerns base-game eligibility, not geography.

48 geographic Vale encounters (46 random, 2 scripted); 80 other geographic encounters currently assigned expansion 0; 2 system records. The proposal uses 120 geographic encounters, including scripted encounters, because 27 per main family plus 6 Learn and 6 Trade gives an exact 90/5/5 split without deleting content. This is a planning target, not a user-approved total.

| Family | Existing after proposed classification | Existing random | Target total | New needed |
| --- | ---: | ---: | ---: | ---: |
| Combat | 14 | 14 | 27 | 13 |
| Trick | 24 | 24 | 27 | 3 |
| Aid | 5 | 3 | 27 | 22 |
| Social | 3 | 3 | 27 | 24 |
| Learn | 2 | 2 | 6 | 4 |
| Trade | 0 | 0 | 6 | 6 |
| Total | 48 | 46 | 120 | 72 |

The current raw types are Combat 14, Trick 25, Help 7, Learn 2, Trade 0; Social does not exist. Proposed classification preserves all 48. The finished random pool would be 118 (Aid 25 random + 2 scripted, other main families 27 random each, Learn/Trade 6 each); the catalog would also have 2 system events. If equal random rather than geographic family counts is preferred, revise the quota separately. No selection weighting is proposed.

### Difficulty and rarity

- [ ] Keep difficulty 1 on 114 of 120 geographic records and difficulty 2 on 6 (5%). Existing difficulty 1: 46; difficulty 2: 2 (19001 and 19444, both scripted).
- [ ] Retain both sanctuaries at difficulty 2 provisionally and select four additional difficulty-2 random encounters, preferably one in each major family. All other new encounters difficulty 1. No difficulty 3+ in geographic base game.
- [ ] Define what a rare encounter means: reward quality, narrative rarity, or lower draw probability. Current generator draws uniformly within eligible region pool; no explicit encounter rarity field found. Do not mistake reward type 3 or difficulty 2 for a rarity mechanism.
- [ ] Provisional content target: at least one rare encounter per family (six minimum), included in family counts. Rare Treasurechest (20032) and Hearthguard Sanctuary (19444) currently use reward category 3 and are candidates, not proof of rarity. Keep rare encounters possible at either difficulty. Approve rarity frequency and implementation separately.

## Existing encounter corrections

| ID | Current evidence | Proposed action |
| --- | --- | --- |
| 20068 Fey Greens | Travel subtype, Whistle Reed 10080 Find item 6 but fallback 20 | Find; change fallback to 6 after checking intent |
| 20084 Mystical Vale | Travel subtype; Wisperwind Flute 10094 type 20, fallback 6 | Find; migrate flute to a fitting type and preserve engraved K clue |
| 20070 Enigmatic Prairies | Trick/Purge, Rosethorn Locket 10082 type 28 and Find skill fallback | Keep Trick/Find provisionally; review locket and replace purge lane with coherent Find pair or approve a real purge scene |
| 20107 Silver Wolf | Combat/Protect; Wolfsbane Elixir 10119 type 26, Hunt fallback | Keep Combat; review elixir purpose and choose Combat/Purge/Ambush; cross-family alternative only if deliberate |
| 20111 Young Redeye | Combat/Find, playful pup, Divining Locket type 6 | Trick/Find; review/remove combat fallback unless deliberately intended |
| 20190 Veilwalker | Trick/Stealth, stealth pair 35/36 | Combat/Ambush; retain nonviolent evasion |
| 20192 Nereval Elite | Trick/Speech, speech pair 17/18 | Social/Speechcraft; keep follow 19001 |
| 20185 Earthsinger's Challenge | Help/Inspiration, speech and inspiration lanes | Social/Performance or Inspiration; review primary/fallback |
| 20186 Melody's Bloomwalker | Help/Inspiration, dance invitation | Social/Performance or Inspiration |
| 20187 Ember's Journeykindler | Help/Inspiration, exhausted Rokur in need of aid | Aid/Aid; review inspiration item and replace with fitting aid option |
| 20189 Zephyr's Embrace | Help/Protect, aid and combat options | Aid/Aid; preserve intentional combat alternative |
| 20087 Radiant Heath | Find plus Inspiration fallback 39 | Keep Trick/Find; verify whether cross-family alternative is intentional |
| 20091–20096 | Combat weapons in slots with Hunt item fallback 30 | Review primary/secondary coherence; mixed lanes may be intentional |
| 20032, 20098, 20119 | OpenLock primary item with no same-slot fallback | Review deliberate key requirement; not automatically an error |
| 20188 Mystic Hearth's Seal | Combat/Purge | Keep; preserve follow 19444 |
| 20051, 20108, 20110 | Hunt or Stealth subtypes | Plan migration to Ambush |

Review all 48 records, including narrative intent, primary item and secondary skill/item pairs, element, difficulty, reward and map position. Cross-family alternatives may remain where they genuinely fit. Do not rewrite a scene solely to match a stale generated subtype. The base audit found no existing Climb encounter; use the three new Trick slots for Climb provisionally, or rebalance repetitive Find encounters after review.

## Local work checklist

- [ ] Confirm proposed total 120, Performance, Aetherion/Hidden Market scope, subtype balance and rarity; Ambush is approved.
- [ ] Establish an explicit base-game allowlist or valid inactive expansion assignments for the 80 out-of-Vale records; preserve IDs, prose, art, links and ownership. Do not delete or release future expansion content. Existing expansions must retain their established access.
- [ ] Check all random, travel, forced-follow, room/prepared and persisted snapshot paths; ensure no isolated content enters the new base game unintentionally. Preserve legitimate already-unlocked expansion access and paid entitlements; avoid stranding active rooms or saves.
- [ ] Update encounter family definitions, labels, statistics, achievement mapping and tests. Preserve existing Helper progress when presenting Aid; propose Social achievement chain separately.
- [ ] Implement approved solution taxonomy across shared/client/server, specialization selection and persisted numeric specialization values. Audit type 20 (travel), 32 (rare item), 29/30 and 35/36, 37/38 (legacy warmth) and all current references. Keep stable solution IDs, inventory charges, equipment, rarity and rewards; plan compatibility for old snapshots and future expansion records. Do not modify unrelated future-expansion stories.
- [ ] Update subtype inference script so it cannot reintroduce retired categories or overwrite reviewed manual assignments.
- [ ] Review the existing 48 encounters using the ledger below and resolve flagged cases before locking counts.
- [ ] Create 13 Combat encounters: distribute across Combat, Purge and Ambush; favor missing Purge and nonviolent evasion.
- [ ] Create 3 Trick encounters, provisionally Climb.
- [ ] Create 22 Aid encounters: distribute across Heal, Aid and Nurture.
- [ ] Create 24 Social encounters: distribute across Speechcraft, Inspiration and approved third category.
- [ ] Create 4 Learn encounters.
- [ ] Create 6 Trade encounters.
- [ ] For each new encounter: unique ID, Vale location, canon-grounded prose, element, family/subtype, valid primary/secondary solutions, reward and difficulty. Preserve one primary item maximum unless design is explicitly revised. Track image WebP separately; text approval is not artwork completion.
- [ ] Verify all families, subtypes, rarity and difficulty quotas; confirm 120 geographic encounters plus 2 universal events, 118 random candidates and both sanctuary links.
- [ ] Run `npm run verify:static-data`, `npm run test:encounter`, relevant specialization/achievement/region-selection tests and typecheck; check desktop and mobile, save compatibility, locked content and actual encounter draws. Record evidence and release separately.

## Existing content review ledger

### Combat

- [ ] 20034 — Menacing Goldhorn (Combat; difficulty 1)
- [ ] 20051 — Nagar Charger (Hunt; difficulty 1)
- [ ] 20052 — Nagar Elder (Combat; difficulty 1)
- [ ] 20091 — Nagar Berserk (Combat; difficulty 1)
- [ ] 20092 — Nagar Boar (Combat; difficulty 1)
- [ ] 20093 — Bonecrusher (Combat; difficulty 1)
- [ ] 20094 — Nagar Humpback (Combat; difficulty 1)
- [ ] 20095 — Nagar Razorback (Combat; difficulty 1)
- [ ] 20096 — Thunderhoof (Combat; difficulty 1)
- [ ] 20107 — Silver Wolf (Protect; difficulty 1)
- [ ] 20108 — Shena Alpha (Stealth; difficulty 1)
- [ ] 20110 — Mother Wolf (Stealth; difficulty 1)
- [ ] 20188 — Mystic Hearth's Seal (Purge; difficulty 1)
- [ ] 20190 — Veilwalker (Stealth; difficulty 1)

### Trick

- [ ] 20001 — Lovely Meadows (Find; difficulty 1)
- [ ] 20002 — Enchanted Glades (Find; difficulty 1)
- [ ] 20003 — Fae Pastures (Find; difficulty 1)
- [ ] 20004 — Mystic Grass (Find; difficulty 1)
- [ ] 20005 — Seraphic Plains (Find; difficulty 1)
- [ ] 20032 — Rare Treasurechest (OpenLock; difficulty 1)
- [ ] 20068 — Fey Greens (Travel; difficulty 1)
- [ ] 20069 — Celestial Fields (Find; difficulty 1)
- [ ] 20070 — Enigmatic Prairies (Purge; difficulty 1)
- [ ] 20071 — Arcane Meadows (Find; difficulty 1)
- [ ] 20072 — Tranquil Wilds (Find; difficulty 1)
- [ ] 20080 — Dreamy Valley (Find; difficulty 1)
- [ ] 20081 — Arcadian Hills (Find; difficulty 1)
- [ ] 20083 — Enchanted Gardens (Find; difficulty 1)
- [ ] 20084 — Mystical Vale (Travel; difficulty 1)
- [ ] 20085 — Bucolic Dale (Find; difficulty 1)
- [ ] 20086 — Captivating Downs (Find; difficulty 1)
- [ ] 20087 — Radiant Heath (Find; difficulty 1)
- [ ] 20088 — Mesmerizing Hillsides (Find; difficulty 1)
- [ ] 20089 — Magical Glens (Find; difficulty 1)
- [ ] 20090 — Ethereal Glades (Find; difficulty 1)
- [ ] 20098 — Common Chest (OpenLock; difficulty 1)
- [ ] 20111 — Young Redeye (Find; difficulty 1)
- [ ] 20119 — Simple Treasure (OpenLock; difficulty 1)

### Aid

- [ ] 19001 — Nerevals Sanctuary (Heal; difficulty 2; scripted)
- [ ] 19444 — Hearthguard Sanctuary (Nurture; difficulty 2; scripted)
- [ ] 20187 — Ember's Journeykindler (Inspiration; difficulty 1)
- [ ] 20189 — Zephyr's Embrace (Protect; difficulty 1)
- [ ] 20193 — Joyful Riverkeeper (Nurture; difficulty 1)

### Social

- [ ] 20185 — Earthsinger's Challenge (Inspiration; difficulty 1)
- [ ] 20186 — Melody's Bloomwalker (Inspiration; difficulty 1)
- [ ] 20192 — Nereval Elite (Speech; difficulty 1)

### Learn

- [ ] 20011 — Magic Source (Learn; difficulty 1)
- [ ] 20074 — Mysterious Cube (Learn; difficulty 1)

### Trade



## Isolated content inventory (reference only)

No content work on these lands in this phase. The IDs below are currently expansion 0, not all worldwide encounters in those lands.

| Region | Count | IDs |
| --- | ---: | --- |
| Eldertree Forest | 21 | 20006, 20007, 20027, 20031, 20036, 20039, 20040, 20041, 20042, 20043, 20045, 20046, 20047, 20048, 20049, 20060, 20067, 20073, 20114, 20115, 20117 |
| Frostwind Mountains | 9 | 20008, 20061, 20100, 20102, 20103, 20104, 20109, 20120, 20121 |
| Everwinter Valley | 1 | 20009 |
| Evergrove | 11 | 20010, 20016, 20021, 20024, 20029, 20033, 20053, 20064, 20125, 20127, 20191 |
| Aetherion | 1 | 20012 |
| Emberfrost | 7 | 20013, 20017, 20019, 20020, 20030, 20059, 20126 |
| Celesterra | 7 | 20014, 20023, 20028, 20054, 20058, 20065, 20076 |
| Fyrskar Mountains | 7 | 20015, 20018, 20056, 20097, 20099, 20106, 20128 |
| Shattered Peaks | 5 | 20022, 20025, 20026, 20055, 20105 |
| Desert of Ohgar | 4 | 20035, 20063, 20066, 20101 |
| Swamp of Karrhu | 6 | 20037, 20038, 20057, 20077, 20082, 20116 |
| Rocky Tundra | 1 | 20122 |

## Evidence and attribution

Sources: [encounter data](../server/game/encountersdata.json), [solution data](../server/game/solutiondata.json), [engine types](../server/src/engine/types.ts), [map assignments](../client/src/ui/game/worldMap/encounterLocations.ts), [map CSV](data/encounter_locations.csv), [selection logic](../server/src/services/encounterGenerator.ts), [specializations](../shared/src/specialization.ts), [achievement mapping](../server/src/domain/achievements/encounterSolveAchievements.ts). ChatGPT (GPT-6.2) joined the source data, audited all 48 Vale slot records, computed quotas, and drafted the plan from my creative direction. Individual classifications and Performance remain subject to review; Ambush is approved. Documentation only: no gameplay or production changes, no runtime tests performed.

## Studio coordination — 2026-11-25

The [shared production ledger](CONTENT_PRODUCTION_LEDGER.md) supersedes the unchecked list above for task allocation and status tracking; the original audit remains reference. Rechecked at [e8f09155](https://github.com/babunidev/Morkahja/commit/e8f091557463a505b63490003f359563c8922b92): 203 worldwide encounters, 247 solutions, 48 current Vale-label records and six Aetherion-label records within the Vale polygon. Hidden Market is expansion 0; five city records belong to expansion 1004. Retain the 48 baseline, 72 new reservations and 120 target provisionally until scope and total are confirmed.

| Family | Target | Proposed subtype targets | Existing proposed mix | New work / revision |
| --- | ---: | --- | --- | --- |
| Combat | 27 | 9 Combat / 9 Purge / 9 Ambush | 8 / 1 / 5 | 1 / 8 / 4 |
| Trick | 27 | 9 Find / 9 Open Lock / 9 Climb (pending revision approval) | 21 / 3 / 0 | 3 Climb; equal split also requires six Find-to-Open-Lock and six Find-to-Climb revisions |
| Aid | 27 | 9 Heal / 9 Aid / 9 Nurture | 1 / 2 / 2 | 8 / 7 / 7 |
| Social | 27 | 9 Speechcraft / 9 Inspiration / 9 Performance (pending) | 1 / 0 / 2 pending | 8 / 9 / 7 pending |
| Learn | 6 | 6 Learn | 2 | 4 |
| Trade | 6 | 6 Trade | 0 | 6 |

No Trick revisions approved: 21 Find / 3 Open Lock / 3 Climb is the preservation baseline, not desired balance. Do not approve revisions by arithmetic. Difficulty remains 114 D1 and 6 D2, with four additional random D2 provisionally one per principal family; both sanctuaries remain D2. Each family must contain rare encounters; at least one each is a minimum content proposal, not a draw-rate or reward mechanic.

Open decisions, in order: (1) whether Hidden Market joins base-game Trade while Aetherion expansion 1004 stays protected; (2) confirm 120 total; (3) approve or reject Performance; (4) approve subtype rebalancing, especially Trick; (5) define rare content frequency separately from future implementation. Present individually; do not reopen Ambush, Aid or retired categories. No new numeric types for pending support.
