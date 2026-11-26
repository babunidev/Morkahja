# World map — placements and sources (2026-11-17)

The in-game world map (`client/src/ui/game/worldMap/`) opens from the region plate on the encounter frame. Babuni set the style: gold ground, every line in the dark red, straight angled lines only (no curves, no right angles), triangles as the only symbols, borders built like the frame's lines. Claude Code (Claude Opus 5.5) drew it from Babuni's notes and the MorkahjaWorld archive (`~/Projects/MorkahjaWorldBuilding`). Where the two agree, the placement is listed as such; where neither gives a direction, the placement is a drawing choice and can be moved freely in `worldMapData.ts`.

| Place | On the map | Source |
| --- | --- | --- |
| Ethera's Vale | Centre | Babuni; `Places/Etheras_Vale.md` ("broad central region") |
| Aetherion | Centre of the Vale | Babuni; `Places/Aetherion.md`, `Places/Ethera.md` (above Ethera's heart) |
| Eldridia | Central, south of Aetherion | Babuni; `Places/Unplaced_Lands.md` (central; Pantheon Temple south of it) |
| Pantheon Temple | South of Eldridia, toward Eldertree | `Places/Pantheon_Temple.md` |
| Lovely Meadows | West part of the Vale | Babuni; in the Vale, no direction in the archive — drawing choice |
| Arcane Meadows | North-east of the Vale | `Places/Vale_Landmarks.md` |
| Hearthguard Sanctuary | North of the Vale | `Places/Hearthguard_Sanctuary.md` |
| Nereval's Sanctuary | Central meadows of the Vale | `Places/Nerevals_Sanctuary.md` |
| Eldertree Forest (Emerald Realm inside) | South of the Vale | Babuni; `Places/Eldertree_Forest.md` ("southern central") |
| Desert of Ohgar | Further south | Babuni ("Orgar"); `Places/Ohgar.md` (desert, no direction) |
| Sunstone Oasis | Southernmost point | Babuni; `Unplaced_Lands.md` (south) |
| Celesterra | South-west, beneath mountains | Babuni; `Places/Celesterra.md` ("beneath the southwestern mountain ranges") |
| Grimnir Skylands | Above Celesterra; a few in the north | Babuni; `Places/Grimnir_Skylands.md`, `Races/Grimnir.md` |
| Stormrift | South-west | `Unplaced_Lands.md` |
| Rocky Tundra | West | Babuni; `Unplaced_Lands.md` (west, associated with Fyrskar) |
| Keldor (Blackwood Abyss, Darkwood Thicket, Verdani's Vigil) | West, above the tundra | Babuni; `Keldor_Landmarks.md` (western), `Wolves_and_Liani.md` (Vale lies to Keldor's south-east) |
| Fyrskar Mountains (Rokur) | North-west | `Places/Fyrskar_Mountains.md` (northern) — north-west is a drawing choice |
| Shattered Peaks | North | `Unplaced_Lands.md` |
| Frostwind Mountains (Skyreach Peak) | Between the Vale and Everwinter | Babuni; `Frostwind_Mountains.md` |
| Everwinter Valley | Furthest north | Babuni; `Everwinter_Valley.md` (in the Frostwind range) |
| Everwinter Trading Post | South edge of Everwinter | Babuni; `Everwinter_Trading_Post.md` |
| Ruins of Nekalos | North-east of Everwinter | Babuni; `Frostweaver_Palace_Ruins.md` names Nekalos, no direction |
| Deepstone Hollow | Beside Everwinter | `Deepstone_Hollow.md` (vault near Everwinter); Babuni thinks the name is older lore |
| Emberfrost | North-east (top right) | Babuni; `Unplaced_Lands.md` |
| Embermire | North-east | `Unplaced_Lands.md` |
| Swamp of Karrhu | East | Babuni ("Karhu"); `Places/Karrhu.md` (swamp, no direction) |
| Evergrove (Verdani) | South-east | Babuni; `Places/Evergrove.md` (desert realm, no direction) |
| Rotwood | South-east, toward Eldertree | `Unplaced_Lands.md`; `Eldertree_Forest.md` |

Roads leave Aetherion toward every land and streams converge on it, after the Vale's "trade routes" and "converging elemental streams". Not on the map: Atranor (a divine realm, not a place in the world), the Eternal Twilight Grove and other sites with no region in the archive.

**Expansion markers:** 0 → Ethera's Vale, 1001 → Keldor, 1003 → Everwinter Valley, 1004 → Aetherion. Since D-063 (2026-11-26) the other ten lands are regional expansions 1005–1014 (`REGION_EXPANSIONS` in `worldMapData.ts`); while inactive, travel there is closed. Urcogor Ravage (1002) is a world event, not a place, and has no marker.

## Per-encounter markers (2026-11-17)

Babuni's list `docs/data/encounter_locations.csv` places all 203 encounters: a land (`map_region`), how the place was chosen (`placement_basis`: narrative landmark, expansion assignment, or an interpretive proposal not established as canon) and a pixel position measured on the zoomed-out map. `client/src/ui/game/worldMap/encounterLocations.ts` is generated from it: pixels become map units with x = (px − 16) / 0.444 and y = (py + 14) / 0.444, the fit that puts 194 of 195 placed points inside their named land. Points within 12 units of a border move toward the land's middle (19), the five expansion 1004 Aetherion encounters sit on the city, and Atranor (1) and the level-up (2) have no place. A test checks that every encounter in `server/game/encountersdata.json` has an entry and lies in its land. To change a placement, edit the CSV and regenerate the module.

On 2026-11-25, the creative approved moving Hidden Market (20012) away from the Aetherion pin to western Ethera's Vale, southeast of Lovely Meadows near the western trade road. The source CSV (195.82, 231.09) and map entry [405, 552] agree under the documented transform. No separate public site marker was added.
