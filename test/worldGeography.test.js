import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('world admin exposes directional geography without replacing the zone map',async()=>{
 const world=await source('src/WorldAdministration.jsx'),panel=await source('src/ZoneGeography.jsx');
 assert.match(world,/import ZoneGeography/);
 assert.match(world,/<ZoneGeography key=\{region\}/);
 assert.match(world,/<WorldTerritoryMap key=\{activeZoneId\}/);
 assert.match(panel,/adjacentZone\(placeable,activeZone,dir\)/);
 assert.match(panel,/world-admin\/geography\/zones/);
 assert.match(panel,/world-admin\/geography\/regions/);
 assert.match(panel,/Airship only from other regions/);
});
