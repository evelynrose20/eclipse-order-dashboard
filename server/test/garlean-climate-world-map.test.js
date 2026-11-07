import test from 'node:test';
import assert from 'node:assert/strict';
import {garleanWeather,effectiveWeather,cToF,fToC,validMapIcon,validRouteType,validWaypoints} from '../src/garlean-climate.js';
import {civicOutlook} from '../src/world-administration.js';
import {readFile} from 'node:fs/promises';

test('Garlean weather tracks the real Gregorian calendar: cold winter, mild warm season',()=>{
 const winter=garleanWeather('2026-01-20T12:00:00Z'),summer=garleanWeather('2026-07-20T12:00:00Z');
 assert.equal(winter.season,'winter');
 assert.equal(summer.season,'summer');
 assert.ok(winter.temperature_f<32,winter.temperature_f+'F');
 assert.ok(summer.temperature_f>=52&&summer.temperature_f<=78,summer.temperature_f+'F');
 assert.ok(winter.temperature_f<summer.temperature_f);
 assert.equal(winter.source,'garlean_calendar_model');
});
test('calendar weather is stable per day, independent of request time/restarts',()=>{
 assert.deepEqual(garleanWeather('2026-11-07T01:22:00Z'),garleanWeather('2026-11-07T23:59:00Z'));
 assert.notEqual(garleanWeather('2026-01-10').date,garleanWeather('2026-02-10').date);
});
test('manual weather remains available with exact Fahrenheit conversion',()=>{
 assert.equal(cToF(0),32);
 assert.equal(Math.round(fToC(32)),0);
 assert.equal(effectiveWeather({weather_mode:'manual',weather:'magitek storm',temperature_c:-25},new Date('2026-07-10')).temperature_f,-13);
 assert.equal(effectiveWeather({weather_mode:'garlean_seasonal',weather:'manual',temperature_c:-25},new Date('2026-07-10')).season,'summer');
});
test('civic projection responds to cold seasonal weather without mutating settlement',()=>{
 const settlement=Object.freeze({food_days:25,food_variety:85,heating_coverage:30,insulation:45,food_access:90,medical_access:90,unrest:0});
 const w=effectiveWeather({weather_mode:'garlean_seasonal'},new Date('2026-01-15'));
 const s=effectiveWeather({weather_mode:'garlean_seasonal'},new Date('2026-07-15'));
 assert.ok(civicOutlook(settlement,w).heat_demand>civicOutlook(settlement,s).heat_demand);
});
test('map marker and transport paths use allowlisted safe data',()=>{
 assert.ok(validMapIcon('refinery'));
 assert.ok(validMapIcon('mine'));
 assert.ok(!validMapIcon('<script>'));
 assert.ok(validRouteType('road'));
 assert.ok(validRouteType('rail'));
 assert.ok(!validRouteType('unknown'));
 assert.ok(validWaypoints([{x:0,y:100},{x:60,y:25}]));
 assert.ok(!validWaypoints([{x:-3,y:200}]));
 assert.ok(!validWaypoints(Array.from({length:17},()=>({x:50,y:50}))));
});
test('map migration is repeatable, references existing sites and does not mutate canon',async()=>{
 const sql=await readFile(new URL('../sql/042_world_routes_garlean_weather.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_map_routes/);
 assert.match(sql,/information_schema\.COLUMNS/i);
 assert.match(sql,/garlean_seasonal/);
 assert.match(sql,/REFERENCES world_settlements\(id\)/);
 assert.doesNotMatch(sql,/INSERT INTO world_map_routes|DELETE FROM world_settlements|DROP TABLE/i);
});
