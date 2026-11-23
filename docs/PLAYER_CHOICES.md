# Player choice concept — equipment, specialization, edit, travel (draft)

**Creative:** Babuni
**Status:** concept settled by Babuni on 2026-11-23 and recorded as [D-056](DECISIONS.md). Nothing here is implemented yet.

## Why

Right now an avatar has almost no identity, and a run is almost all chance. Every turn is a fresh draw: the encounter decides what fits, and I spend whatever item happens to match until it is gone. The element system (D-053, D-055) was my first step toward a character that is *mine*: a fire avatar is better with fire essences and loses the others faster. This concept takes the next steps. I want more choice and less randomness, and I want those choices to be visible and to matter in play. The balance pass (D-054) made the game harder, so a little earned bonus here is a fair compensation.

Four choices come together:

1. **Equipment:** two items I keep alive through good rolls.
2. **Specialization:** a type of skill my avatar is good at, +1 to its rolls.
3. **Edit:** change how my avatar looks, paid with gems.
4. **Travel:** choose the region I play in, paid with gems.

Two principles hold for all of them:

- **No chance outside the dice.** Nothing adds a hidden percentage. Every effect is read from the roll total the player already sees.
- **A solution fits its encounter.** None of this lets a sword solve a Help encounter. Equipped items and specializations count only where their type already fits, as a primary solution or in a matching secondary slot.

Bots take no part: they have no equipment and no specialization.

## The avatar selection screen

The avatar selection, which appears after pressing Play, gets new buttons under the three avatars: **Equipment**, **Edit** and **Specialization**. They are plain buttons with the golden frame and the red background. A dead avatar is not in the selection, so it cannot be equipped, specialized or edited.

Each button switches the screen into a *choose* mode:

- The Play button disappears.
- A label **"Choose your avatar"** appears above the three avatars, in the same plate style as the region plate, the Inventory and Skillbook titles, and the level-up's "Choose your reward".
- Tapping an avatar opens that mode's screen for this avatar (below).
- Pressing the mode's button again, or the chosen avatar, returns to the normal selection, and the Play button comes back.

## 1. Equipment

### Rules

| Rule | Detail |
| --- | --- |
| Slots | Two. Each holds a different item; any two items, two weapons too. |
| What can be equipped | Items. Not skills (they have the specialization), not essences, not Atranor items (they have their own rules, D-018, D-053, D-055). |
| Equipping | The item goes into the slot **with all its charges**, plus **one extra charge** that belongs to the slot. |
| Using an equipped item, which charge | The extra charge is always spent **first**. |
| Using an equipped item | It spends a charge as usual. |
| Total of **12 or higher** | The item gets **1 charge back**: no loss. |
| Total of **20 or higher** | The item gets **2 charges back**: one more than before. |
| Total below 12 | The charge is spent. |
| Several uses in one encounter | In a set (difficulty 2–4) each use is judged by **its own** roll. Two uses at 9 and 14: one charge lost, one charge back. |
| Hardship and Misery | **Cannot take** an equipped item's charges. Equipment is protected from failure losses. |
| Breaking | An equipped item can still run empty through rolls below 12. It breaks and the slot is free. |
| Changing | There is no unequip button: I **swap**, by equipping another item into an occupied slot. The item that leaves **loses one charge**, the extra one, whether it was spent or not. With only one charge left, it disappears from the inventory. Equipping it again later gives a new extra charge. |
| When I can change it | In the avatar selection; and in the game, but only once my choice in the current encounter is made, so I can't switch for the encounter in front of me. |
| Showing the regain | Not as one of the encounter's rewards. It shows on the equipped item itself. |

"Total" means the roll result as shown, the same number the outcome table reads: d20 + slot bonus (+ a rare item's +1) − difficulty penalty.

### What the thresholds mean with today's bonuses

At difficulty 1, with primary d20 + 5 and secondary d20 + 2 (D-054):

| Slot | 12+ (no loss) needs | 20+ (one ahead) needs |
| --- | --- | --- |
| Primary (+5) | natural 7+ (70 %) | natural 15+ (30 %) |
| Rare primary (+6) | 6+ (75 %) | 14+ (35 %) |
| Secondary (+2) | 10+ (55 %) | 18+ (15 %) |
| Rare secondary (+3) | 9+ (60 %) | 17+ (20 %) |

Each step of difficulty above 1 needs one more on the natural roll. An encounter rarely names one particular item as its primary solution, so in practice an equipped item mostly plays in secondary slots. *(Worked out by Claude Code from the shared dice constants.)*

### Screens

- **In the avatar selection:** in Equipment mode, tapping an avatar moves it to the side and an equipment card appears in the middle, in the same style as the in-game equipment card. The card shows the two slots. Tapping a slot opens this avatar's inventory; choosing an item puts it in the slot and the inventory closes back to the card.
- **In the game:** tapping my avatar opens the small overlay that shows experience. It gets an **Equipment** button that opens the same card.

## 2. Specialization

- Specialization is for **skills only**. Items have equipment; skills have specialization.
- With a specialization chosen, every roll made with a **skill** of that type gets **+1**, in any slot: a specialized primary skill rolls d20 + 5 + 1, a specialized secondary skill d20 + 2 + 1. It also counts toward the own essence on 24 or higher (D-054).
- Every avatar can choose any type. (Role-based lists, for example a Rogue choosing from Stealth, Open Lock and Find, may come later, perhaps once there is a fourth role.)
- It can only be chosen and changed **in the avatar selection**, never during the game, so it is a longer-term choice than equipment. A change is confirmed with the green check, as in the avatar creation. The **first choice is free; every change costs 1 gem**.
- **Screen:** in Specialization mode, tapping an avatar opens a list of specializations on the left and the description of the selected one on the right.

### The types and their descriptions

There are fifteen types that have skills. Travel and Rare Find exist only as items. Life (16) and Resurrection (76) are special skill types and are left out of the list.

*The descriptions are drafts by Claude Code (Claude Opus 5.5) for Babuni to revise. They describe a way of facing the world; they make no lore claims.*

| Specialization | Skill type | Draft description |
| --- | --- | --- |
| Combat | 9 | You meet danger with force. Where others hesitate, you step forward and strike. Your fighting skills are drilled until they are second nature. |
| Hunt | 29 | You read tracks, wind and silence. Prey and predator alike are a trail to follow, and you know when to wait and when to loose. |
| Purge | 27 | Corruption, curses and the restless dead have learned to fear you. You cleanse what should not be and burn out what cannot be saved. |
| Stealth | 35 | You are the shadow at the edge of the firelight. You pass unseen, strike unheard, and are gone before anyone thinks to look. |
| Find | 5 | Nothing stays hidden from you for long. A loose stone, a faint smell, a footprint in the dust: you notice what others walk past. |
| Open Lock | 7 | Locks, seals and wards are puzzles to you, and you enjoy puzzles. Doors that stay closed for others open for you. |
| Climb | 13 | Cliffs, walls and towers are paths to you. You trust your grip and your balance, and the heights hold no fear. |
| Heal | 21 | You close wounds and ease pain. Where you walk, the hurt get back on their feet. |
| Protect | 25 | You stand between the helpless and harm. Your skills shield, guard and hold the line. |
| Nurture | 33 | You care for the growing and the fragile: creatures, plants and people. Under your hand, what is weak becomes strong. |
| Warmth | 37 | You bring fire to the cold and comfort to the weary. Frost and despair loosen their grip where you are. |
| Inspiration | 39 | Your words and deeds kindle courage. Others find their strength again because of you. |
| Speech | 17 | You win with words. Guards step aside, merchants soften, and enemies hesitate when you speak. |
| Learn | 1 | Knowledge is your weapon. Old texts, strange runes and new ideas open their secrets to your patient mind. |
| Trade | 3 | You know what things are worth and what people want. A good bargain is a victory, and you win many. |

## 3. Edit avatar

- In Edit mode the avatars **stay where they are**; only the Play button gives way to "Choose your avatar".
- Tapping an avatar opens the avatar edit screen: the avatar creation screen with race, role and gender locked and cut away. What can change is **only the look and the name**:
  - **Portrait:** tapping the avatar steps through the portraits of the same race, role and gender; a back button steps back.
  - **Frame:** chosen as in the creation.
  - **Name:** a new name costs **50 gems**.
- The gem cost is shown at the bottom, with **Cancel** on the left and **Agree** on the right. Agree asks once more ("Do you want to spend … gems?"); Yes applies the change.
- **Price:** only what actually changes. The portraits and frames already carry a gem value in the game data (`avatarGems`, `frameGem`, not charged anywhere yet). A new frame costs that frame's gems, a new portrait that portrait's gems, a new name 50. Keeping a part costs nothing.

## 4. Travel to a region

### On the map

- On the world map, hovering a region **highlights** it.
- Regions I don't have yet are **marked in red**.
- **An available region:** clicking it asks "Travel to <region>? It costs <n> gems. Are you sure?" Yes spends the gems, travels there at once, and the next encounter is a random encounter of that region's expansion.
- **A locked region** (for example Everwinter Valley without its expansion): clicking it says "You have not unlocked this region yet. Would you like to take a look?" Yes opens the Expansions menu focused on that region's expansion, where I see its information and how to unlock it. Closing the menu brings me back to the map.

### Rules

| Rule | Detail |
| --- | --- |
| Where I can go | A region is its **expansion**, not the lands drawn on the map. Travelling to Everwinter Valley draws a random encounter of expansion 1003. A base-game encounter that happens to be placed in Everwinter on the map does not make it an Everwinter encounter. |
| After arriving | Only the next encounter is guaranteed to come from there. After that the usual rules apply: a written follow-up first, otherwise the region roll (d20, stay in the same expansion on 1–14, about 70 %, `SAME_EXPANSION_STAY_MAX` in `encounterGenerator.ts`). Staying means staying in the **expansion**, so I keep travelling through all of its encounters, wherever they sit on the map. |
| Price | **A tenth of the expansion's gem price**, rounded: Keldor 8 (unlock 75), Everwinter Valley 5 (50), Aetherion 3 (25). **The base game costs 1 gem**: every land whose encounters are in expansion 0 (Ethera's Vale, Eldertree Forest, Evergrove, Celesterra…) counts as the same destination. |
| When | **Any time**, even before I have made my choice in the current encounter, and in the middle of an encounter chain, which it breaks. Travelling swaps the current encounter for one from the destination: I pay gems to swap the encounter, and the one I leave brings no reward and no loss. |
| Not from system events | Atranor and the level-up are events, not places: travel is not possible while one is open. Atranor always comes when the last essence is gone, and travel cannot skip it. |
| My own or a solo room | I travel, alone. |
| A shared room where I am the host | I take everyone with me. Nobody has to agree; the host is the group leader. |
| A shared room I joined | Travelling means **leaving** that room: I go on alone to the region I chose. The host can take me wherever they travel while I stay. |

### Content still to sort out

Today the base game (expansion 0) has encounters placed in many lands: Eldertree Forest, Evergrove, Celesterra, Fyrskar and others (`docs/data/encounter_locations.csv`). Babuni will revise the content so that a region and its expansion line up. Until then, travel works by expansion: Ethera's Vale (the base game, 0), the Cursed Forest of Keldor (1001), Everwinter Valley (1003) and Aetherion (1004). Later every region may become its own expansion, with only some free, perhaps the races' homelands (Fyrskar Mountains, Celesterra, Evergrove) and the Eldertree Forest. That is future work and not part of this concept.

## Contributions

**Babuni:** the goal (identity and choice over randomness), the no-chance-outside-the-dice principle, every rule above, the avatar-selection modes and their screens, region travel and the locked-region path to the Expansions menu, 2026-11-23. **Claude Code (Claude Opus 5.5):** read the current slot, bonus, charge, solution-type, gem, map and encounter-location data; proposed alternatives in discussion (a chance to save a charge, protection from losses, improvised use in any slot; Babuni kept the protection and rejected the other two); wrote this document, the threshold table, the specialization description drafts and the open questions.
