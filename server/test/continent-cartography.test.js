import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTerritoryPolygon} from '../src/world-continent.js';

const migration=readFileSync(new URL('../sql/075_continent_cartography.sql',import.meta.url),'utf8');
test('continent polygons accept valid bounded territory outlines',()=>{
 assert.equal(validateTerritoryPolygon([{x:100,y:100},{x:300,y:100},{x:280,y:220},{x:100,y:220}]),null);
});
test('continent polygon validation rejects self-intersection, duplicate corners and tiny areas',()=>{
 assert.equal(validateTerritoryPolygon([{x:10,y:10},{x:200,y:200},{x:10,y:200},{x:200,y:10}]),'territory_area_too_small');
 assert.equal(validateTerritoryPolygon([{x:10,y:10},{x:200,y:10},{x:200,y:200},{x:10,y:200},{x:150,y:0}]),'territory_self_intersection');
 assert.equal(validateTerritoryPolygon([{x:10,y:10},{x:100,y:10},{x:10,y:10}]),'duplicate_territory_vertex');
 assert.equal(validateTerritoryPolygon([{x:-1,y:0},{x:100,y:0},{x:20,y:50}]),'invalid_territory_coordinates');
});
test('continent migration is non-destructive and retains existing zones',()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS world_continent_territories/);
 assert.match(migration,/FOREIGN KEY\(zone_id\) REFERENCES world_zones\(id\)/);
 assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE|DELETE FROM world_zones/i);
});
