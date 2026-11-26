# Find-to-Climb conversions — Round 2 drafts

**Creative:** Babuni
**Date:** 2026-11-26
**For:** 00 Management and Chat 02, answering the [Climb conversion brief](DEVELOPER_BRIEF_CLIMB_CONVERSIONS.md)
**Drafted by:** Claude Code (Claude Opus 5.5)
**Status:** **drafts for approval. No game data changed.** Round 1 (20068, 20005, 20004) was approved and applied the same day (`77f4aaee`, see [Round 1](CLIMB_CONVERSIONS_ROUND_1.md)).

## Fresh assessment after Round 1

- **All three keep a Climb.** Each picture already has a real vertical feature: boulders and crags, a tree over a hollow, and a standing rock. None needs a prop the land doesn't have.
- **Dreamy Valley is not a better Open Lock.** Its passage is open, and nothing in the prose or the picture is locked or sealed. Making it Open Lock would mean inventing a door. It stays a Climb, with the passage's floor blocked by fallen stone.
- **The lyre:** Dreamy Valley's "lyre identity" lives in its old primary, the Dreamy Lyre, not in the prose. The draft keeps the music in the wind that spirals through the passage. The lyre item itself is untouched in the data.
- **Items:** one specific climbing item per encounter, reused from Round 1 because only three suit the Vale (the frost hooks belong to the north). Faewoven Ladder goes over the boulders, Seeker's Grapnel to the branch, Climbing Gear up the rock.
- **Counts if approved:** Find 15, Open Lock 3, Climb 6, as in the brief's table. The old primaries (Dreamy Lyre 10086, Whistle of Harmony 10083, Mesmerizing Windchime 10098) are used by no other encounter. They stay in the data and in players' inventories as Find items (type 6).
- **Classification:** the same pattern as Round 1. B gets a specific climbing item, with any climbing item (type 14) as fallback. C gets any Climb skill (type 13). The subtype becomes Climb, and the element is kept and added to the classification script's overrides.

## 4. 20080 Dreamy Valley

**Picture:** a valley of pink blossom between pale crags, great boulders and rock towers on both sides.

**Kept:** the flowers, the golden light, the petals, the leaning boulders, the sheltered valley beyond, the spiralling wind; element Arcana, difficulty 1, reward 2 × 1.

> A sea of delicate pink blossoms fills the valley, flowing between enormous sun-warmed rocks like a gentle river of flowers.
>
> The air is sweet with their fragrance, and the afternoon sunlight lends the entire landscape a soft, golden warmth. Great boulders rise from the meadow in scattered formations, their weathered surfaces pale and smooth, with little pockets of cool shade resting beneath them.
>
> A quiet breeze wanders between the stones, carrying loose petals into the air. Some settle upon the rocks, while others drift farther down the valley, following the gentle curves of the land.
>
> Beyond a low grassy ridge, two immense boulders lean toward one another. Where a narrow passage once ran between them, fallen stone now fills the gap almost to the height of their shoulders, its edges softened by moss and blossom. Only above it, where the two great rocks nearly touch, does the opening remain.
>
> The wind moves differently there, gathering the petals into slow, wandering spirals and drawing a faint, sweet note from the stone before carrying them over the top and out of sight.
>
> Through the gap high between the boulders, another stretch of the valley lies sheltered from the sun, its distant blossoms glowing softly between the stones.

| Slot | Now | Proposed |
| --- | --- | --- |
| B | 10086 Dreamy Lyre / type 6 | **10167 Faewoven Ladder / type 14** |
| C | 0 / type 5 | **0 / type 13** |
| A, D | 0 / 0 | unchanged |

## 5. 20071 Arcane Meadows

**Picture:** a green valley of flowering folds under a great sky, with a large tree leaning over the slope on the right.

**Kept:** north-eastern Ethera's Vale, the murmuring crowns, the flowers and narrow openings, the hidden treasure, the shaded hollow and the branch that stirs; element Nature, difficulty 1, reward 2 × 1.

> Long shadows stretch between the flowering hills northeast of Ethera's Vale. A breeze travels through the trees, setting one crown murmuring after another before spilling out across the meadows.
>
> Flowers crowd the gentle folds of the land. Their colors deepen where the slopes turn from the sun, and narrow openings wind between them, disappearing around each rise. The air smells of warm leaves and pollen. Somewhere within this enchanted ground, a treasure is said to remain hidden.
>
> At the edge of a shaded hollow stands an old tree, its trunk leaning out over the drop. Its lowest branches begin far above the grass, and the bark below them is smooth, worn by wind and weather. High along one bough, where the leaves grow thin, something catches the light for a moment and is gone.
>
> The hills offer no single direction, only their curves and the occasional glint of light between stems. Above the shaded hollow, that one branch stirs after the rest have settled.

| Slot | Now | Proposed |
| --- | --- | --- |
| B | 10083 Whistle of Harmony / type 6 | **10211 Seeker's Grapnel / type 14** |
| C | 0 / type 5 | **0 / type 13** |
| A, D | 0 / 0 | unchanged |

## 6. 20088 Mesmerizing Hillsides

**Picture:** golden light over green hillsides, a tall standing rock with a tree growing beside it, boulders scattered down the slope.

**Kept:** the small creature, the two gentle hills, the passing cloud and the changing light, the blossoms that appear high above; element Air, difficulty 1, reward 2 × 1. The climb is short and exposed: one rock in the hollow, not a mountain.

> A narrow trail of movement runs through the tall grass, weaving across a shaded hillside before vanishing into the greenery.
>
> For an instant, a small creature emerges among the stems. It pauses with its ears raised, then disappears down the slope, leaving the grasses trembling behind it.
>
> Two great hills rise on either side of a sheltered hollow, their gentle curves covered in deep green vegetation and scattered wildflowers. Sunlight bathes one slope in warmth, while the other remains beneath the shadow of a passing cloud.
>
> In the hollow between them stands a single tall rock, sheer on the side that faces the path and broken into narrow ledges on the other. A tree has rooted against its back, but its branches turn away from the stone. Near the top, where the wind runs hardest, a small shelf of flowers clings to the rock.
>
> Between the hills, the wind gathers into a soft, rushing current. Leaves turn upon their stems, and entire stretches of grass bend together, changing the colors of the hillsides as though invisible hands were brushing across them.
>
> Gradually, the cloud moves on.
>
> A golden band of sunlight crosses the hollow and climbs the tall rock, ledge by ledge, until the little shelf at its top shines with blossoms that had almost disappeared into the shade.

| Slot | Now | Proposed |
| --- | --- | --- |
| B | 10098 Mesmerizing Windchime / type 6 | **10071 Climbing Gear / type 14** |
| C | 0 / type 5 | **0 / type 13** |
| A, D | 0 / 0 | unchanged |

## Verification

- No data changed. The records, the pictures and the climbing items were read; the slot pattern is the one checked in Round 1.
- On approval: the data edit, the overrides in `scripts/assign-encounter-element-subtype.mjs`, `npm run release:check`, and the ledger updated after the commit.
