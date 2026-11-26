import assert from 'node:assert/strict';
import { EXPANSION_FOCUS, MAP_HEIGHT, MAP_PATHS, MAP_REGIONS, MAP_SITES, MAP_WIDTH } from './worldMapData.js';
import { clampView, cornerAngle, pointInPolygon, scaleLimits, scatterInside, zoomAt } from './worldMapGeometry.js';

// Babuni's drawing rule (2026-11-17): angled straight lines, never a right angle.
for (const region of MAP_REGIONS) {
  const outline = region.outline;
  outline.forEach((point, index) => {
    const before = outline[(index + outline.length - 1) % outline.length]!;
    const after = outline[(index + 1) % outline.length]!;
    const angle = cornerAngle(before, point, after);
    assert.ok(Math.abs(angle - 90) > 6, `${region.id} has a near right angle (${angle.toFixed(1)}°) at ${point}`);
  });
  assert.ok(pointInPolygon(region.label, outline), `${region.id} label sits inside its land`);
}
for (const path of MAP_PATHS) {
  for (let index = 1; index < path.points.length - 1; index += 1) {
    const angle = cornerAngle(path.points[index - 1]!, path.points[index]!, path.points[index + 1]!);
    assert.ok(Math.abs(angle - 90) > 6, `${path.id} has a near right angle (${angle.toFixed(1)}°)`);
  }
}

// Everything is on the map, and the places from the notes are where the lore puts them.
for (const site of MAP_SITES) {
  assert.ok(site.at[0] > 0 && site.at[0] < MAP_WIDTH && site.at[1] > 0 && site.at[1] < MAP_HEIGHT, site.id);
}
const at = (id: string) => MAP_SITES.find((site) => site.id === id)!.at;
const region = (id: string) => MAP_REGIONS.find((entry) => entry.id === id)!;
const centre = (id: string) => region(id).label;
assert.ok(pointInPolygon(at('aetherion'), region('vale').outline), 'Aetherion stands in the Vale');
assert.ok(at('sunstone-oasis')[1] === Math.max(...MAP_SITES.map((site) => site.at[1])), 'Sunstone Oasis is the southernmost point');
assert.ok(centre('everwinter')[1] < centre('frostwind')[1] && centre('frostwind')[1] < centre('vale')[1], 'Everwinter, then Frostwind, then the Vale, north to south');
assert.ok(centre('eldertree')[1] > centre('vale')[1] && centre('ohgar')[1] > centre('eldertree')[1], 'Eldertree south of the Vale, Ohgar further south');
assert.ok(centre('keldor')[0] < centre('vale')[0] && centre('keldor')[1] < centre('rocky-tundra')[1], 'Keldor in the west, above the Rocky Tundra');
assert.ok(centre('karrhu')[0] > centre('vale')[0] && centre('emberfrost')[1] < centre('karrhu')[1], 'Karrhu east, Emberfrost north-east');
assert.ok(centre('evergrove')[0] > centre('vale')[0] && centre('evergrove')[1] > centre('vale')[1], 'Evergrove south-east');
assert.ok(at('pantheon-temple')[1] > at('eldridia')[1], 'Pantheon Temple south of Eldridia');
assert.ok(at('trading-post')[1] > at('nekalos')[1] && at('nekalos')[0] > at('trading-post')[0], 'Nekalos north-east, trading post south in Everwinter');
for (const [expansion, focus] of Object.entries(EXPANSION_FOCUS)) {
  assert.ok(focus.at[0] > 0 && focus.at[1] > 0, `expansion ${expansion} has a place`);
}

// Symbols stay inside their land and apart.
const points = scatterInside(region('vale').outline, 20, 'vale');
assert.ok(points.length >= 15);
assert.ok(points.every((point) => pointInPolygon(point, region('vale').outline)));
assert.deepEqual(points, scatterInside(region('vale').outline, 20, 'vale'), 'seeded, the same every time');

// The view never leaves the map, and zooming keeps the point under the pointer.
const limits = scaleLimits(400, 400, MAP_WIDTH, MAP_HEIGHT);
assert.ok(limits.min < limits.open && limits.open < limits.max);
const clamped = clampView({ cx: -500, cy: 99999, scale: limits.open }, 400, 400, MAP_WIDTH, MAP_HEIGHT, limits);
assert.equal(clamped.cx, 400 / limits.open / 2);
assert.equal(clamped.cy, MAP_HEIGHT - 400 / limits.open / 2);
const whole = clampView({ cx: 10, cy: 10, scale: limits.min / 2 }, 400, 400, MAP_WIDTH, MAP_HEIGHT, limits);
assert.equal(whole.scale, limits.min);
const zoomed = zoomAt({ cx: 500, cy: 500, scale: 1 }, 2, 300, 100, 400, 400);
assert.equal(zoomed.cx + (300 - 200) / zoomed.scale, 500 + (300 - 200) / 1);
assert.equal(zoomed.cy + (100 - 200) / zoomed.scale, 500 + (100 - 200) / 1);

console.log('worldMap.test.ts passed');

// Babuni's placement list (2026-11-17): every encounter in the game has an entry,
// and every placed one sits inside the land it names.
{
  const { readFileSync } = await import('node:fs');
  const { ENCOUNTER_LOCATIONS } = await import('./encounterLocations.js');
  const encounters = JSON.parse(readFileSync(new URL('../../../../../server/game/encountersdata.json', import.meta.url), 'utf8')) as Record<string, { mEncounterID: number }>;
  for (const record of Object.values(encounters)) {
    assert.ok(record.mEncounterID in ENCOUNTER_LOCATIONS, `encounter ${record.mEncounterID} has a map entry`);
    const place = ENCOUNTER_LOCATIONS[record.mEncounterID];
    if (place) {
      const land = MAP_REGIONS.find((entry) => entry.id === place.regionId)!;
      assert.ok(pointInPolygon(place.at, land.outline), `encounter ${record.mEncounterID} lies in ${place.regionId}`);
    }
  }
  assert.equal(ENCOUNTER_LOCATIONS[1], null, 'Atranor is not on the map');
  assert.equal(ENCOUNTER_LOCATIONS[2], null, 'the level-up is not on the map');
  const { mapFocusFor } = await import('./WorldMap.js');
  assert.deepEqual(mapFocusFor(20181, 1004)?.at, at('aetherion'), 'an Aetherion encounter sits on the city');
  assert.equal(mapFocusFor(1, 0), null);
  assert.deepEqual(mapFocusFor(99999, 1001), EXPANSION_FOCUS[1001], 'unknown encounters fall back to their land');
}

// Travel (D-056, D-063): a region is its expansion; Aetherion is its own; only the Vale is the base game.
{
  const { travelTargetFor, REGION_EXPANSIONS } = await import('./worldMapData.js');
  assert.equal(travelTargetFor('region:keldor')?.expansion, 1001);
  assert.equal(travelTargetFor('region:everwinter')?.expansion, 1003);
  assert.equal(travelTargetFor('site:aetherion')?.expansion, 1004);
  assert.equal(travelTargetFor('region:eldertree')?.expansion, 1005);
  assert.equal(travelTargetFor('region:vale')?.expansion, 0);
  for (const region of MAP_REGIONS) {
    assert.ok(region.id === 'vale' || region.id in REGION_EXPANSIONS, `${region.id} is an expansion, not the base game`);
  }
  for (const [regionId, expansion] of Object.entries(REGION_EXPANSIONS)) {
    const focus = EXPANSION_FOCUS[expansion];
    assert.equal(focus?.regionId, regionId, `expansion ${expansion} opens the map on ${regionId}`);
    assert.ok(pointInPolygon(focus!.at, region(regionId).outline), `expansion ${expansion}'s map point lies in ${regionId}`);
  }

  // Every encounter of a regional expansion is placed in that land, and no
  // base-game encounter outside the Vale is left (20009 is held, D-063).
  const { readFileSync } = await import('node:fs');
  const { ENCOUNTER_LOCATIONS } = await import('./encounterLocations.js');
  const encounters = JSON.parse(readFileSync(new URL('../../../../../server/game/encountersdata.json', import.meta.url), 'utf8')) as Record<string, { mEncounterID: number; mEncounterExpansion: number }>;
  for (const record of Object.values(encounters)) {
    const place = ENCOUNTER_LOCATIONS[record.mEncounterID];
    if (record.mEncounterExpansion >= 1005) {
      assert.equal(REGION_EXPANSIONS[place?.regionId ?? ''], record.mEncounterExpansion, `encounter ${record.mEncounterID} is placed in its expansion's land`);
    }
    if (record.mEncounterExpansion === 0 && place && place.regionId !== 'vale') {
      assert.equal(record.mEncounterID, 20009, `base-game encounter ${record.mEncounterID} lies outside the Vale`);
    }
  }
  assert.equal(travelTargetFor('region:vale')?.name, "Ethera's Vale");
  assert.equal(travelTargetFor('site:eldridia'), null, 'other sites are not destinations of their own');
  assert.equal(travelTargetFor('region:nowhere'), null);
}
