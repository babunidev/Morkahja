# Regional expansion migration — implementation report

**Creative:** Babuni
**Date:** 2026-11-26
**For:** 00 Management, answering the [regional migration brief](DEVELOPER_BRIEF_REGIONAL_EXPANSIONS.md)
**Implemented by:** Claude Code (Claude Opus 5.5)
**Status:** on GitHub `main`, **not released**. Decision records: D-063 and D-064 in [DECISIONS.md](DECISIONS.md).

> **Update the same day (D-064):** Babuni accepted every Evergrove recommendation below and placed 20009 in Celesterra (1009), so nothing is held. The ten regions now have gem prices, texts and banners and are listed in the Expansions menu as coming soon, still inactive. Counts now: Eldertree 27, Evergrove 3, Celesterra 8, the Vale 49 random encounters. Sections below describe the first step as it was done.

## What changed

The base game is now Ethera's Vale. 78 of the 79 out-of-Vale encounters carry their regional expansion ID; 20009 is held (see below). Ten inactive catalog entries exist for the regions. No encounter text, title, picture, solution, reward, difficulty, element or follow link changed; only `mEncounterExpansion`, and for 20127 its map point.

| Region | ID | Encounters | Catalog entry |
| --- | ---: | ---: | --- |
| Eldertree Forest | 1005 | 22 (incl. 20127) | inactive, not listed |
| Frostwind Mountains | 1006 | 9 | inactive, not listed |
| Evergrove | 1007 | 10 | inactive, not listed; biome review below |
| Emberfrost | 1008 | 7 | inactive, not listed |
| Celesterra | 1009 | 7 | inactive, not listed |
| Fyrskar Mountains | 1010 | 7 | inactive, not listed |
| Shattered Peaks | 1011 | 5 | inactive, not listed |
| Desert of Ohgar | 1012 | 4 | inactive, not listed |
| Swamp of Karrhu | 1013 | 6 | inactive, not listed |
| Rocky Tundra | 1014 | 1 | inactive, not listed |
| Held in expansion 0 | — | 1 (20009) | — |
| **Total** | | **79** | |

The catalog entries hold only `mExtensioActive: false`, `mExtensioID`, `mExtensioName` and `mExtensioListed: false`. They have **no** gem price, euro price, reward, text or images: those are Babuni's decisions, so I did not invent placeholders. An entry without a whole-number gem price cannot be unlocked even if it were switched on, and the static-data check now refuses an active expansion without one.

## Manifest reconciliation

Checked against current `main` before editing (IDs 1005–1014 were free in both catalogs):

- 203 records: 130 in expansion 0 (49 Vale geographic, 2 universal, 79 out-of-Vale), 73 in existing expansions (Keldor 48, Everwinter 20, Aetherion 5). Same as the pinned audit.
- All 79 manifest rows exist, were in expansion 0, and their titles match the data exactly.
- No written follow leads into or out of any of the 79. The ten follows in the data all stay inside their own land.
- After the change: expansion 0 holds 52 records (49 Vale, Atranor, Level up, held 20009). A base-game player's random pool has 47 encounters, all in the Vale.

## How the regions stay closed

| Path | Before | Now |
| --- | --- | --- |
| Random draw | expansion 0, or an expansion the account lists | additionally the expansion must be **active**, and held encounters are never drawn (`server/src/services/encounterAvailability.ts`) |
| Travel on the map | every land except Keldor and Everwinter was "the base game" | every land except the Vale is its expansion; an inactive one shows "*Eldertree Forest* is not open to travellers yet" with only Back; the server already refused inactive destinations |
| Unlock with gems | refused when inactive | unchanged, plus refused when the price is missing |
| Paid checkout | hard-coded SKUs 1001–1004 | unchanged; no SKU for the new regions |
| Written follows | bypass the filter | the static-data check now fails if a follow leads into another expansion |
| Prepared next encounter | random draws are made at resolution time, not stored | no change needed; system events (Atranor, level-up) are not regional |
| Saved rooms and snapshots | — | an encounter already on screen finishes as it is; nothing is invalidated. A room showing one of the 79 right after a release plays it to the end, then draws from the Vale |
| Expansions menu | listed every catalog entry | hides `mExtensioListed: false`; it still shows Keldor, Everwinter, Aetherion and the inactive Urcogor event as before |

Existing entitlements are untouched: Keldor, Everwinter and Aetherion keep all their encounters for owners (checked in the test), and Urcogor (1002) keeps its definition.

**Consequence to know:** travelling to Eldertree, Frostwind, Evergrove and the other seven lands was possible until now, because they counted as the base game. After a release, those lands are closed until their expansions open. Players can still travel to the Vale, Aetherion, Keldor and Everwinter Valley.

## 20127 Eternal Twilight Grove

Moved to Eldertree Forest (1005). New map point: map units [490, 854], CSV pixels 233.6 × 365.2. That is inside the Eldertree outline, at least 22 units from its border, and the point farthest from any other placed encounter (about 49 units), so the pin does not overlap others. It sits in the south-west of the forest. The exact place is not canon; it was my choice. In the world archive (MorkahjaWorld `3962553`, line endings restored in `8f5b8ca`), the grove's page names Eldertree Forest as its region, and Eldertree Forest lists the grove among its known areas and related lore. The spirits, the twilight and the Moonchime Harp are unchanged. The canon update is recorded separately in that repository's CHANGELOG, DEVLOG and DECISIONS.

## 20009 Grimnir Vault — held

The encounter stays in expansion 0, but it is excluded from every new draw (random and travel). It is not given to the active Everwinter expansion. Evidence for the review:

- The prose: "This far into Deepstone Hollow, with Everwinter Valley not far beyond" — near Everwinter, not inside it.
- The archive's [Deepstone Hollow](https://github.com/babunidev/MorkahjaWorld/blob/main/Places/Deepstone_Hollow.md): "a cave in northern Deepstone Hollow, near Everwinter Valley".
- The game map draws the Deepstone Hollow site, and places 20009's pin, **inside** Everwinter Valley's outline. The placement CSV says "Everwinter Valley is explicitly named in the encounter prose", which overstates it: the prose names the valley as nearby.
- Options: give it to 1003 (Everwinter owners gain one encounter; an entitlement change), to 1006 Frostwind (the archive's Chests and Vaults page places a related Grimnir trunk "in an icy Frostwind cave near Deepstone Hollow"), or keep it held.

## Evergrove review (ten encounters, now in 1007)

Evergrove canon: a desert heartland of dunes, salt flats, mesas, oasis-gardens, canals and living Nexus roots. I read each record, its lore entries and its picture. The recommendations below are mine, for Babuni's decision; nothing was rewritten or moved beyond the manifest.

| ID | Encounter | Recommendation | Evidence |
| --- | --- | --- | --- |
| 20010 | Verdani Casket | **Relocate to Eldertree (1005)** | Text: "this quiet stretch between Eldertree Forest and Evergrove"; archive: "young woodland associated with Eldertree Forest and the approaches to Evergrove … exact border unsettled". The picture is dense temperate forest with ferns and no desert. Keeping it would need the border defined as wooded. |
| 20016 | Ailing Verdani | **Relocate to Eldertree**, or retain with a light rewrite | Moss, ferns and a clearing. The picture is a lush forest floor. Verdani travel widely (archive), so a sick Verdani in the forest needs no rewrite. As an oasis refuge it would need the setting rewritten, and the picture shows no oasis. |
| 20021 | Blightwraith Huntress | **Relocate to Eldertree** | Blightwraiths are corrupted Verdani (Magic Corruption). The archive gives the Huntress woodland. The picture is a misty forest ravine. The Eldertree page names Rotwood as "a wound spreading toward the forest's deeper roots"; Rotwood is unplaced (south-east) and would be a natural home. |
| 20024 | Blightwraith Rootrot | **Relocate to Eldertree**; or retain only as Nexus root sickness, with a rewrite | Evergrove lists "root sickness" and "disrupted water veins" as hazards, which supports a rewrite. But the current prose is wet forest decay, and the picture shows tree-like figures in a misty forest. |
| 20029 | Blightwraith Occultist | **Relocate to Eldertree** (decided on its own, as asked) | A "clearing of blackened roots", a canopy and saplings. The picture is a meadow at a forest edge. Nothing desert or oasis in it. |
| 20033 | Wild Bloodfang | **Return to the Vale (base game)** | The archive: Bloodfang is a Nagar boar, and "Nagar are enormous wild boars of Ethera's Vale". The Evergrove placement was only a map label. The picture is a charging boar without landscape cues. It would need a Vale map point. |
| 20053 | Exhausted Verdani | **Retain in Evergrove** (edge of an oasis-garden; optional light rewrite) | Text: "At the edge of Evergrove". The picture is a green meadow, readable as a cultivated oasis edge. |
| 20064 | Altar of Umbrael | **Retain** | The archive places it in Evergrove explicitly. The picture is a cave mouth under rock and roots, with nothing that contradicts an oasis setting. |
| 20125 | Raided Verdani Village | **Retain** | The archive calls it "an Evergrove community". The picture shows domed, grown-looking houses, a river or canal and a great elder tree, which matches "buildings curve around water flow" and "canals". The prose's "river" could become "canal" in a later pass; no rewrite needed. |
| 20191 | Slumbering Ogru | **Return to the Vale (base game)** | The archive's Peoples of the Ravage: "An account from eastern Ethera's Vale describes a large grey Ogru sleeping beneath a willow". The picture is a willow on an open meadow. It would need a Vale map point. |

If all ten were accepted: Evergrove 3 (20053, 20064, 20125); Eldertree +5 (27); the Vale +2 random encounters (49).

## Blockers and open decisions (Babuni)

1. **Commercial terms** for every new region: gem price, euro price, reward ID, summary, text and the three shop images. Until then the entries cannot be listed or bought.
2. **Activation and listing.** Switching a region on needs `mExtensioActive: true`, a gem price, and either `mExtensioListed` removed or set to true. A Stripe SKU and price are needed only if it is sold for money.
3. **The "All Expansions" bundles** grant 1001, 1003 and 1004 only. Whether past bundle buyers receive future regions is a commercial decision.
4. **20009** placement (above).
5. **Evergrove**: the ten recommendations (above).
6. **Regional ambiance**: no recordings exist for the new IDs. The ambiance player looks for the folder filed as the ID minus 1000 and plays nothing regional when it is empty. This only matters once a region opens.
7. **Babuni Admin**: its "Add expansion" form used to start at ID 1010, switched on. That ID is now Fyrskar's, and saving the form would have overwritten Fyrskar and switched it on. Fixed in babuni.admin `11b6eb7`: a new expansion now starts switched off, on the next free ID. Admin saves write one record at a time, so they keep the new fields. The Admin detail view shows "undefined" for the missing prices of the new regions; this is cosmetic.

## Assets

None added. No pictures, shop art or audio were created or changed.

## Files

- Data: `server/game/encountersdata.json` (78 × `mEncounterExpansion`), `server/game/expansiondata.json` (+1005–1014), `docs/data/encounter_locations.csv` (78 expansion IDs; 20127's region, point and note).
- Server: `server/src/services/encounterAvailability.ts` (new: held list, open check), `encounterGenerator.ts` (draws), `gameData.ts` (shop fields optional, `mExtensioListed`), `playerService.ts` (a missing price cannot be unlocked).
- Client: `worldMap/worldMapData.ts` (`REGION_EXPANSIONS`, `EXPANSION_FOCUS`), `worldMap/encounterLocations.ts` (20127), `worldMap/TravelPrompt.tsx` and `blocks/EncounterImageBlock.tsx` (closed land), `dashboard/ExpansionsOverlay.tsx` (unlisted entries hidden).
- Checks: `scripts/verify-static-game-data.mjs` (expansion IDs and names, active needs a price, no cross-expansion follows); tests `server/src/services/regionalExpansions.test.ts` (new) and `client/src/ui/game/worldMap/worldMap.test.ts`.

## Verification (run 2026-11-26 on Nobara, local PostgreSQL in Podman)

- `npm run release:check`: static data verified, typecheck and build passed, client tests 52/52, server tests 77/77.
- New `regionalExpansions.test.ts`:
  - Data matches the manifest, the counts per expansion are exact, and 1005–1014 are inactive, unlisted and unpriced.
  - A base-game player's whole random pool contains only the Vale and none of the 79.
  - An owner of 1001, 1003 and 1004 gets exactly those expansions' random encounters added.
  - An account that lists 1005, 1006, 1007 and 1014 gets nothing from them.
  - Travel never draws 20009.
  - Travel to 1005 is refused as `UNKNOWN_DESTINATION`, and unlocking 1006 as inactive.
- `worldMap.test.ts`:
  - Every land except the Vale is an expansion.
  - Each region's map focus lies inside its land.
  - Every encounter of 1005–1014 is placed in its expansion's land.
  - No base-game encounter outside the Vale is left except held 20009.
- babuni.admin unit suite: 146/146 before and after its fix.
- In the local game (headless Chromium, new local test players, 1280 × 800 and 390 × 844):
  - Every land except the Vale shows the locked tint.
  - Eldertree Forest and Evergrove show "is not open to travellers yet" with only Back.
  - Keldor still offers its expansion.
  - The Expansions menu lists 1001, 1003, 1004 and 1002 only.
- Screenshots in `~/Pictures/Development Screenshots/MorkahjaWebApp/2026-11-26/`: `2026-11-26-regions-map-closed-lands-{desktop,phone}.png`, `2026-11-26-regions-travel-{eldertree,evergrove}-closed-{desktop,phone}.png`, `2026-11-26-regions-expansions-menu-{desktop,phone}.png`.
- **Not verified:** a real round with a player who owns expansions after the change (covered by the test only), and a production release.
