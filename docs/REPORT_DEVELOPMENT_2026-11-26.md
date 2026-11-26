# Developer report — 26 November 2026

**Creative:** Babuni
**For:** 00 Management (the regional migration and Climb briefs, and everything Babuni decided after them the same day)
**Developer:** Claude Code (Claude Opus 5.5)
**Status:** everything below is on GitHub `main`, checked locally, and **released on 26 November at 06:26 UTC as 0.9.0-beta.84** (backup `20261126-062610`, frontend `20261126-062614`).

Detailed records: [regional implementation report](REPORT_REGIONAL_EXPANSIONS_2026-11-26.md), [Climb Round 1](CLIMB_CONVERSIONS_ROUND_1.md), [Climb Round 2](CLIMB_CONVERSIONS_ROUND_2.md), decisions D-063 to D-066 in [DECISIONS.md](DECISIONS.md), and [CHANGELOG.md](../CHANGELOG.md).

## 1. Results at a glance

| Topic | Result |
| --- | --- |
| Base game | Ethera's Vale only: 45 random encounters, plus Atranor, Level up and the two scripted sanctuary encounters (19001, 19444). |
| Regional expansions | Ten regions created as 1005–1014. The three homelands are open to players who earn them. The other seven are listed as "coming soon". |
| Evergrove review | Babuni accepted every recommendation: five encounters moved to Eldertree, two returned to the Vale, three stay in Evergrove. |
| 20009 Grimnir Vault | Moved to Celesterra (1009), the Grimnir homeland, with its text adjusted. The world archive was updated to match. |
| Find to Climb | All six conversions approved and applied. The base game has 6 Climb encounters. |
| Find encounters | Four Find encounters without a letter clue are set aside in the inactive catalog entry 1999. The base game has exactly nine Find, including all eight letter encounters (MORKAHJA; the R was added to 20090). |
| Weather | Lands without their own recordings (the homelands, the coming regions, Urcogor) play the Vale's weather for now. |
| Homeland message | After the Homecoming achievement, each opened homeland gets its own notification: "… is unlocked. You can now travel there." |
| Homelands | The new "Homecoming" achievement: one avatar with 100 encounters opens its people's homeland. Homelands cannot be bought with gems. |
| Prices | Gem prices only, by land size: big 75, medium 50, small 25. No money prices yet. |
| Bundles | Both all-expansions bundles now grant every expansion, including ones added later. Neither is offered in the shop yet. |
| Fix | The in-game avatar card shows what was used and rolled in the encounter again. |
| Admin tool | "Add expansion" started on ID 1010, switched on, which would have overwritten Fyrskar. It now starts switched off on the next free ID. |

## 2. Catalog after the day (203 records)

| Expansion | Encounters | State |
| --- | ---: | --- |
| 0 Ethera's Vale (base game) | 49 | 45 random, plus 1, 2, 19001 and 19444 |
| 1001 Keldor | 48 | active, unchanged |
| 1003 Everwinter Valley | 20 | active, unchanged |
| 1004 Aetherion | 5 | active, unchanged |
| 1002 Urcogor Ravage | 0 | inactive event, unchanged |
| 1005 Eldertree Forest | 27 | coming soon, medium, 50 gems |
| 1006 Frostwind Mountains | 9 | coming soon, medium, 50 gems |
| 1007 Evergrove | 3 | **homeland of the Verdani, open** |
| 1008 Emberfrost | 7 | coming soon, medium, 50 gems |
| 1009 Celesterra | 8 | **homeland of the Aevis and the Grimnir, open** |
| 1010 Fyrskar Mountains | 7 | **homeland of the Rokur, open** |
| 1011 Shattered Peaks | 5 | coming soon, small, 25 gems |
| 1012 Desert of Ohgar | 4 | coming soon, medium, 50 gems |
| 1013 Swamp of Karrhu | 6 | coming soon, big, 75 gems |
| 1014 Rocky Tundra | 1 | coming soon, medium, 50 gems |
| 1999 Set aside | 4 | inactive, hidden, never drawn |

**The base game's 45 random encounters:**
- **Combat 14:** Combat 8, Hunt 2, Stealth 2, Protect 1, Purge 1.
- **Trick 23:** Find 9, Climb 6, Open Lock 3, Stealth 2, Purge 1, Travel 1 (20084, which has the K letter), Speech 1.
- **Aid 5:** Inspiration 3, Protect 1, Nurture 1.
- **Learn 2.**
- **Trade 1.**

**Size tiers** come from the land areas on the world map, in map units:
- **Big, about 40 encounters planned:** Evergrove 54k, Celesterra 53k, Karrhu 48k.
- **Medium, about 20 encounters planned:** Ohgar 40k, Eldertree 35k (already 27), Rocky Tundra 35k, Fyrskar 34k, Frostwind 33k, Emberfrost 31k.
- **Small, about 10 encounters planned:** Shattered Peaks 15k.
- **Reference points:** Keldor (45k, 48 encounters) is the big tier, Everwinter the medium tier and Aetherion the small tier.
- **Homelands:** the gem value of the three homelands only sets their travel price, which is a tenth of it.

## 3. Decisions made by Babuni today

1. **D-063, regional isolation as briefed.** IDs 1005–1014 were checked to be free. Every route into an inactive region is closed:
   - random draws
   - travel (a closed land says "… is not open to travellers yet")
   - unlocking with gems (an expansion without a price cannot be unlocked)
   - written follows (the data check now rejects a follow into another expansion)
2. **D-064, placements, prices and listing:**
   - The Evergrove review was accepted as recommended.
   - 20009 goes to Celesterra.
   - Prices are set by size tier.
   - The regions are listed as coming soon, with text taken from the world archive. Their banners are cut from each land's own encounter paintings and stand in until real art exists.
   - Bundle buyers own everything, including expansions added later.
3. **D-065, Homecoming:**
   - 100 encounters with one avatar open its people's homeland, once and permanently. Verdani open Evergrove, Rokur open Fyrskar, and Aevis or Grimnir open Celesterra.
   - The achievement is visible from the first encounter and shows "n / 100 encounters with one avatar".
   - Its three ranks are Rootseeker, Hearthfriend and Child of Morkahja. Each rank adds 1 gem to the Hearth Blessing, as every other chain does.
   - Avatars that already have 100 encounters earn their homeland at server start.
   - Homelands can never be bought with gems. Only the complete package, which is not offered yet, will include them.
   - The three homelands are switched on, so a homeland can be played as soon as it is earned.
4. **D-066, Find encounters, letters and regions:**
   - Six letterless Find encounters were set aside by a seeded random draw. Babuni then confirmed the target of nine Find, so 20001 and 20002 came back. Set aside now: 20003, 20069, 20072 and 20111.
   - The letter encounters stay in the base game. They spell **MORKAHJA**, but the R was missing, so 20090 Ethereal Glades now carries a carved R. All eight are in the base game: M 20087, O 20086, R 20090, K 20084, A 20081, H 20083, J 20085, A 20089.
   - Fey Greens' sanctuary is Verdani work, as the world archive has it. Its text no longer says faun.
   - Every regional placement is decided: no row in the manifest or the placement CSV says "review" any more. The map pin is a game placement, not canon.
5. **The six planned Find-to-Open Lock conversions are not needed for now.** Babuni reduced Find by setting six aside instead. Open Lock stays at 3 unless conversions are requested again.
6. **Travel** always gives a random encounter from the destination's own pool. This was confirmed in the code and is now tested for every open land.

## 4. Canon changes in MorkahjaWorld (Babuni-approved)

- **Eternal Twilight Grove:** belongs to Eldertree Forest (`3962553`, line endings restored in `8f5b8ca`).
- **Grimnir Vault:** its account moved from Deepstone Hollow to Celesterra. Deepstone Hollow keeps its place near Everwinter and points to the vault.
- **Verdani Casket:** lies in Eldertree Forest, on the side facing Evergrove. Both changes are in `4ab7c82`.
- No other lore was rewritten.

## 5. Commits on `main` (Morkahja)

| Commit | Change |
| --- | --- |
| `fc656c28` | Base game is the Vale; ten closed regional expansions; the report and the Climb Round 1 drafts (D-063) |
| `c6461366` | All-expansions bundles own every expansion, also later ones |
| `8491dd82` | Evergrove review; Grimnir Vault in Celesterra |
| `77f4aaee` | Climb Round 1: 20068, 20005, 20004 |
| `eece25b3` | Ten regions listed as coming soon, with gem prices, texts and banners |
| `56800b0f` | D-064 records; Climb Round 2 drafts; ledger |
| `7170e5c6` | In-game avatar card: Used and Roll back in view |
| `b1e92e40` | Homecoming achievement (D-065) |
| `a8ae8bf7` | Climb Round 2: 20080, 20071, 20088 |
| `8d87c02d`, `8c1340b8` | Homecoming progress toward 100; rank 1 renamed Rootseeker |
| `9307379d` | Earned homelands switched on |
| `96765e79` | Test: travel draws from the destination's pool |
| `4a8aead0` | Six Find encounters set aside; Fey Greens is Verdani work; regions decided (D-066) |

Other repositories:
- **babuni.admin:** `11b6eb7`, new expansions start switched off on the next free ID.
- **MorkahjaWorld:** `3962553`, `8f5b8ca` and `4ab7c82`.

## 6. Verification (actually run)

- **Release check:** the final `npm run release:check` on Nobara, against local PostgreSQL in Podman, passed in full. That covers the static-data check, typecheck and build, client tests 52/52 and server tests 78/78.
- **New and extended tests:**
  - **`regionalExpansions.test.ts`:**
    - the data matches the manifest as decided
    - the counts per expansion are exact
    - closed regions give nothing, even to an account that lists them
    - an earned homeland gives its encounters
    - travel picks at random from the destination's own pool and skips recent encounters
    - the set-aside group is never drawn
    - every letter encounter stays in the base game
  - **`homecoming.test.ts`:**
    - 99 encounters are not enough
    - a homeland is earned once, even with two checks at the same moment
    - Celesterra counts once for either people
    - the start-up check works
    - gems are refused
    - the panel's progress is correct
  - **`stripeFulfillment.test.ts`:** a bundle grants every expansion, and expansions added later reach earlier buyers.
  - **`worldMap.test.ts`:** every land except the Vale is an expansion, and every regional encounter is placed inside its own land.
- **Admin tool:** the babuni.admin unit suite passed 146/146.
- **Local game:** checked in headless Chromium on desktop (1280 × 800) and phone (390 × 844), with new test players only:
  - closed lands on the map
  - the Expansions menu with the coming-soon cards and the homeland cards
  - Homecoming at 37 / 100
  - travel to an earned Evergrove: 8 gems, arriving at 20053 Exhausted Verdani
  - the avatar card after a dice roll
- **Screenshots:** in `~/Pictures/Development Screenshots/MorkahjaWebApp/2026-11-26/`.
- **Not verified:** a production release; a real phone; Homecoming being earned through actual play to 100 (the threshold and the start-up check are covered by the test).

## 7. Open items for management

1. **Release:** done as 0.9.0-beta.84. On its first start, existing avatars with 100 encounters earned their homeland; that was not observed in the server log.
2. **Trick targets:** the base game has Find 9 (on target), Climb 6 and Open Lock 3. The base game's geographic count is 47, so the 71 reserved new tasks reach 118 of the 120 target: two more are needed.
   - **Three new Climb encounters:** writing them belongs to Chat 02, which has IDs 20207–20209 reserved. That would bring Climb to 9.
   - **Open Lock and Find:** whether either should reach 9 again (through conversions or new encounters) is Babuni's call.
3. **Review rows added** for the two encounters back in the Vale: 20033 Wild Bloodfang (proposed Combat) and 20191 Slumbering Ogru (proposed nonviolent Ambush). The studio decides.
4. **Homeland content:** Evergrove has 3 encounters, Celesterra 8 and Fyrskar 7, against about 40, 40 and 20 planned.
5. **Before a coming-soon region opens:**
   - its encounters, using the planned counts
   - real banner art, if wanted
   - weather recordings (no ambiance exists for 1005–1014, so the weather bed fades out there)
   - a money price and a Stripe SKU, if it will be sold for money
6. **The complete package:** when to offer it and at what price. It is the only way to buy a homeland.
7. **Set-aside group (1999):** these four return to the base game by changing their expansion back to 0.
8. **Local test data:** the Stripe test leaves its test accounts in the local database. That is harmless, but it inflates the bundle count in the local start-up log. Production has one purchase.
