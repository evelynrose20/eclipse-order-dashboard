import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pregnancyProgress,pregnancyTermDays,conceptionChance,cycleStatus} from '../src/character-reproduction.js';
const client=readFileSync(new URL('../../src/CharacterReproduction.jsx',import.meta.url),'utf8');
const dossier=readFileSync(new URL('../../src/CharacterDossier.jsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../src/character-reproduction.js',import.meta.url),'utf8');

test('pregnancy and parenthood are independent dossier pages, with bound-only monthly cycle',()=>{
 assert.match(dossier,/id:'pregnancy',label:'Pregnancy'/);
 assert.match(dossier,/id:'parenthood',label:'Parenthood'/);
 assert.match(dossier,/character\?\.collar_bound\?\[\{id:'binding-cycle'/);
 assert.match(dossier,/view="pregnancy"/);
 assert.match(dossier,/view="cycle"/);
 assert.match(dossier,/In development/);
});
test('pregnancy page supports unbound conception events and settings without a cycle',()=>{
 assert.match(client,/view='pregnancy'/);
 assert.match(client,/Conception settings/);
 assert.match(client,/bound&&cycle\.active\?title\(cycle\.phase\)/);
 assert.match(client,/No binding modifier/);
 assert.match(client,/New conception event/);
 const cycle=cycleStatus({base_chance:20,cycle_anchor:'2026-11-01'},false,null,new Date('2026-11-11T12:00:00Z'));
 assert.equal(cycle.active,false);
 assert.equal(conceptionChance({base_chance:20},cycle),20);
});
test('three IC months is the new default without changing older records',()=>{
 assert.match(client,/total_days:90/);
 assert.match(api,/pregnancy_total_days:90/);
 assert.ok(api.includes('pregnancy_total_days=?'));
 assert.ok(api.includes('pregnancyTermDays(lineageId)'));
 assert.equal(pregnancyTermDays(null),90);
 assert.equal(pregnancyTermDays(1),4);
 const sql=readFileSync(new URL('../sql/115_pregnancy_ninety_day_default.sql',import.meta.url),'utf8');
 assert.match(sql,/ALTER COLUMN pregnancy_total_days SET DEFAULT 90/);
 assert.doesNotMatch(sql,/UPDATE character_reproductive_profiles/);
 const old={pregnancy_status:'active',pregnancy_anchor:'2026-11-01',pregnancy_start_day:0,pregnancy_total_days:280};
 assert.equal(pregnancyProgress(old,new Date('2026-11-11T00:00:00Z')).total_days,280);
 const newer={...old,pregnancy_total_days:90};
 assert.equal(pregnancyProgress(newer,new Date('2026-11-11T00:00:00Z')).total_days,90);
});
test('player-facing Pregnancy and Parenthood interface does not use fictional labels',()=>{
 assert.doesNotMatch(client,/fictional/i);
 assert.doesNotMatch(dossier,/label:'Pregnancy & cycles'/);
 assert.match(client,/role="dialog"/);
 assert.match(client,/Register pregnancy/);
});
