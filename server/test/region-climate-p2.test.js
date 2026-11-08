import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveWeather,garleanWeather} from '../src/garlean-climate.js';
test('a region-specific monthly curve replaces the default Garlean baseline',()=>{
 const date=new Date('2026-01-15T12:00:00Z');
 const cold=garleanWeather(date,{monthly_f:Array(12).fill(-20),daily_variation_f:0,severity_modifier:0});
 const mild=garleanWeather(date,{monthly_f:Array(12).fill(40),daily_variation_f:0,severity_modifier:0});
 assert.equal(cold.temperature_f,-20);
 assert.equal(mild.temperature_f,40);
 assert.equal(mild.season,'winter');
});
test('dated DM weather event overrides seasonal model only during its period',()=>{
 const region={weather_mode:'garlean_seasonal',weather_events:[{title:'Ceruleum blizzard',weather:'blizzard',temperature_f:-45,starts_on:'2026-11-08',ends_on:'2026-11-11'}]};
 const active=effectiveWeather(region,new Date('2026-11-09T12:00:00Z'));
 const later=effectiveWeather(region,new Date('2026-11-12T12:00:00Z'));
 assert.equal(active.source,'dm_weather_event');
 assert.equal(active.temperature_f,-45);
 assert.equal(active.event_title,'Ceruleum blizzard');
 assert.equal(later.source,'garlean_calendar_model');
});
test('climate repeats deterministically for same day and profile',()=>{
 const region={weather_mode:'garlean_seasonal',climate_profile:{monthly_f:Array(12).fill(12),daily_variation_f:8,severity_modifier:-5}};
 const day=new Date('2026-11-08T12:00:00Z');
 assert.deepEqual(effectiveWeather(region,day),effectiveWeather(region,day));
});
