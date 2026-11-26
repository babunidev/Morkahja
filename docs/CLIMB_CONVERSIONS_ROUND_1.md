# Find-to-Climb conversions — Round 1 drafts

**Creative:** Babuni
**Date:** 2026-11-26
**For:** 00 Management and Chat 02, answering the [Climb conversion brief](DEVELOPER_BRIEF_CLIMB_CONVERSIONS.md)
**Drafted by:** Claude Code (Claude Opus 5.5)
**Status:** **drafts for approval. No game data changed.** Round 2 (20080, 20071, 20088) follows only after a fresh assessment.

## Engine check

- **How a slot works.** In `encounterResolver.ts`, each slot has a *primary* (one exact solution ID) and a *secondary* (any solution of that type). The proposed pattern therefore works as intended:
  - **B:** the chosen climbing item, or any climbing item (type 14).
  - **C:** no primary, any Climb skill (type 13).
- **Climb skills (type 13):**
  - Race and role skills: Skybound Ascension 10042, High Jump 10050, Rivulet Ascension 10197, Cliffhanger's Grasp 10178, Acrobatic Climb 10068 (Rogue).
  - General skill pool: Climb 10070.
- **Climbing items (type 14):** all in the general item pool (reward type 2), the pool for start items and reward-type-2 encounters such as these three. So a Vale-only player can get them.
- **Items left out:** the three frost hooks (10138, 10156, 10160) belong to the cold north, so I left them out for the Vale.
- **After the regional migration,** every existing Climb encounter is outside the Vale, so the base game has none. That is the brief's "zero".
- **Classification:**
  - Fey Greens is currently subtype **Travel** (B type 20), not Find. The working audit counts it as Find.
  - `scripts/assign-encounter-element-subtype.mjs` rewrites every encounter's element and subtype when it is run. With these slots it would infer Climb by itself, but new prose could change the inferred element. So when the data is edited, the three should be added to its `ELEMENT_OVERRIDES` (and `SUBTYPE_OVERRIDES`) to keep the reviewed values.
- **Old primaries.** Whistle Reed 10080, Seraphic Map 10009 and Mystic Map 10008 are each used only by their own encounter. After the change no encounter names them, but they stay in the data. Players keep them, and the two maps still count as Find items (type 6) in other Find encounters. Whistle Reed is a type 6 item too. Nothing is deleted or retagged.
- **Lore note for Fey Greens:** the encounter calls the sanctuary faun craftsmanship, while the archive's [Vale landmarks](https://github.com/babunidev/MorkahjaWorld/blob/main/Places/Vale_Landmarks.md#fey-greens) associate it with Verdani care. The draft keeps the encounter's fauns, as the brief asks; the mismatch is for Babuni.

## 1. 20068 Fey Greens

**Picture:** a towering weathered rock with carved openings and ledges high on its face, trees framing it, deer below. It supports a climb as it is.

**Kept:** title, picture, deer and stag, faun workmanship, peaceful refuge, the glimmer, the old tales, difficulty 1, element Void, expansion 0, reward 2 × 1. The sanctuary is not harmed.

**Revised prose (draft):**

> Sunlight wanders across a wide stretch of green, where deer graze peacefully among tall grasses and scattered wildflowers.
>
> Beyond the meadow rises an immense standing rock, its weathered surface softened by moss and trailing vines. Within its broad face, an ancient sanctuary has been carefully shaped from the stone, its graceful entrance following the natural curves of the rock.
>
> The delicate workmanship bears the gentle character of faun craftsmanship, blending so naturally with the surrounding land that the sanctuary seems almost grown from the earth itself.
>
> Birdsong drifts through the warm air, mingling with the quiet rustling of leaves. A magnificent stag wanders near the stone, untroubled by the ancient structure towering above it.
>
> The entrance below stands open and bare, its threshold swept clean by the wind. Far above it, where the rock leans outward, a narrow ledge holds a second, smaller opening, carved with the same winding patterns. No stair leads up to it. Between the threshold and the ledge, the stone offers only weathered seams, old roots and the cracks where little ferns have taken hold.
>
> Old tales speak of forgotten treasures hidden within these enchanted greens, protected by the quiet magic of the land.
>
> High in the small opening, a delicate glimmer lingers in the shadows, where the sunlight reaches no farther.

**Slots:**

| Slot | Now | Proposed |
| --- | --- | --- |
| A | 0 / 0 | unchanged |
| B | 10080 Whistle Reed / type 20 | **10167 Faewoven Ladder / type 14** |
| C | 0 / type 5 | **0 / type 13** |
| D | 0 / 0 | unchanged |
| Subtype | Travel | **Climb** (mEncounterType 2) |

**Why the Faewoven Ladder:** "A silvery, luminescent rope ladder with steps made of sturdy moonwood. Enchanted leaves flutter around it … Its glow beckons climbers to hidden heights." Its fey make suits the Fey Greens, and a ladder leaves the carved rock unharmed.

## 2. 20005 Seraphic Plains

**Picture:** two huge rough-hewn pillars in a sea of grass, the nearest with a cracked, face-like front far taller than a person; smaller pillars in the distance. A recess high on the near pillar is not painted, but nothing contradicts one; the first sentence of the new paragraph keeps it to "deep cracks". **Image implication:** the recess is new in the prose and absent from the art. It could be repainted later or left to the imagination.

**Kept:** the wind, the hollow resonance, the unknown purpose, the forgotten things, the open sky, difficulty 1, element Earth, expansion 0, reward 2 × 1.

**Revised prose (draft):**

> The Seraphic Plains stretch far beneath the open sky, a vast sea of green where tall grasses rise and fall in the passing wind. Their gentle rustling carries across the hills, mingling with the occasional song of a distant bird.
>
> Scattered across the plains stand immense pillars of rough-hewn stone. Some rise alone, others in quiet groups, their weathered faces marked by deep cracks and the slow passage of ages. Between them, the grasses grow undisturbed, concealing the earth around their ancient foundations.
>
> The wind moves freely through this open land, yet among the pillars its voice changes. A low, hollow resonance drifts between the stones, so faint it almost disappears beneath the rustling grass.
>
> It seems strongest beside the tallest pillar. Far above the grass, where a slab of its face fell away long ago, a dark recess opens in the stone. The cracks that run up toward it are deep enough to hold a hand, and pale lichen marks the places where rain has worn them smooth.
>
> Here, the old world seems close to the living one. Beneath the green hills, forgotten things may still rest, while the pillars stand in silence, their purpose hidden behind centuries of wind and rain.
>
> Above them, the wide sky remains clear, and the plains stretch onward beyond sight.

**Slots:**

| Slot | Now | Proposed |
| --- | --- | --- |
| A | 0 / 0 | unchanged |
| B | 10009 Seraphic Map / type 6 | **10211 Seeker's Grapnel / type 14** |
| C | 0 / type 5 | **0 / type 13** |
| D | 0 / 0 | unchanged |
| Subtype | Find | **Climb** |

**Why Seeker's Grapnel:** "designed for precision, effortlessly securing to even the most precarious holds". It suits one high recess on a single pillar.

## 3. 20004 Mystic Grass

**Picture:** a steep green hill whose top is a heap of weathered rocks, with the pillar standing on it. The draft makes that heap the climb: a real scramble, not walking uphill.

**Kept:** the rolling hills, the wind and light, the changed wind at the pillar's base, the earth keeping something to itself, difficulty 1, element Arcana, expansion 0, reward 2 × 1.

**Revised prose (draft):**

> The hills roll outward in every direction, their long green grasses bending and rising with the wind.
>
> Each gust sends a quiet rustling through the slopes, soft at first, then deeper where the grass grows high and thick. Sunlight drifts across the land in wide, slow bands, brightening one rise while another falls briefly into shade.
>
> Above the surrounding hills, one height lifts a little higher than the rest. At its summit stands a great stone pillar, raised upon a steep heap of weathered rocks. Its surface is rough with age, streaked by rain and pale with lichen, yet it holds itself with an unyielding stillness that draws the eye from far across the grasslands.
>
> Where the grass ends, the slope gives way to the rocks. They lie piled against one another higher than a rider's head, broad slabs leaning on loose stones, their edges slick with lichen where the shade lingers. A few have slid down into the grass and settled there long ago.
>
> Around the pillar's base, at the top of the heap, the wind changes.
>
> The grasses there move in smaller patterns, crossing and circling where the wider hills sway in one direction. Beneath the shifting green, the earth seems to keep something to itself.
>
> The pillar stands silent above it all, watching the wide meadow under the open sky.

**Slots:**

| Slot | Now | Proposed |
| --- | --- | --- |
| A | 0 / 0 | unchanged |
| B | 10008 Mystic Map / type 6 | **10071 Climbing Gear / type 14** |
| C | 0 / type 5 | **0 / type 13** |
| D | 0 / 0 | unchanged |
| Subtype | Find | **Climb** |

**Why Climbing Gear:** "sturdy ropes, carabiners, harnesses, and grip-enhancing gloves". It suits a loose rock scramble. A grapnel fits a single high hold better (Seraphic Plains), and the ladder suits a sheer face (Fey Greens).

## Counts if Round 1 is approved

| | Find | Open Lock | Climb |
| --- | ---: | ---: | ---: |
| Working audit before | 21 | 3 | 0 |
| After Round 1 | 18 | 3 | 3 |

Current data, base game after the regional migration (mEncounterType 2): Find 17, Open Lock 3, Travel 2 (Fey Greens is one), Purge 1, Stealth 1, Speech 1. The working audit's 21 Find includes proposed reclassifications that are not in the data yet.

## Verification

- No data changed, so there are no tests to run for the drafts. The slot semantics, the solution types, their reward pools and the classification script were read in the source.
- The pictures were viewed. Fey Greens and Mystic Grass support the climb as painted; for Seraphic Plains, the high recess is new and not painted.
- When Babuni approves, the data edit follows, with `npm run verify:static-data`, the encounter tests, `npm run typecheck` and `npm test`. The ledger is updated after that commit, not now.
