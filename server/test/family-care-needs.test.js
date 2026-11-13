import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {careNeeds,carePriority} from '../../src/familyCareNeeds.js';

const now=new Date('2026-11-13T12:00:00Z');
const child={id:1,created_at:'2026-11-13T08:00:00Z',stage:'newborn'};

test('new dependent has four usable care meters based on registration time',()=>{
 const needs=careNeeds(child,[],now);
 assert.deepEqual(needs.map(n=>n.id),['nourishment','comfort','hygiene','rest']);
 assert.ok(needs.every(n=>n.value>=20&&n.value<=100));
 assert.ok(needs.every(n=>n.lastAction===null));
});
test('recording milk feeding improves nourishment but does not change unrelated needs',()=>{
 const empty=careNeeds(child,[],now);
 const fed=careNeeds(child,[{action:'bottle',created_at:'2026-11-13T11:59:00Z'}],now);
 assert.ok(fed[0].value>empty[0].value);
 assert.deepEqual(fed.slice(1).map(n=>n.value),empty.slice(1).map(n=>n.value));
});
test('nursing, rest and hygiene independently restore associated meters',()=>{
 const events=[
  {action:'nursing',created_at:'2026-11-13T11:30:00Z'},
  {action:'hygiene',created_at:'2026-11-13T11:30:00Z'},
  {action:'sleep',created_at:'2026-11-13T11:30:00Z'}
 ];
 const values=Object.fromEntries(careNeeds(child,events,now).map(n=>[n.id,n.value]));
 assert.ok(values.nourishment>=80);
 assert.ok(values.hygiene>=85);
 assert.ok(values.rest>=85);
});
test('needs are bounded and priority is the lowest meter',()=>{
 const stale=careNeeds({...child,created_at:'2020-01-01T00:00:00Z'},[],now);
 assert.ok(stale.every(n=>n.value===20));
 assert.equal(carePriority([{id:'rest',value:60},{id:'hygiene',value:25}]).id,'hygiene');
});
test('character dossier renders functional care instead of retired placeholder',()=>{
 const source=readFileSync(new URL('../../src/CharacterDossier.jsx',import.meta.url),'utf8');
 assert.match(source,/active==='parenthood'&&personalRecord&&<FamilyCare/);
 assert.doesNotMatch(source,/Family relationships, guardianships, dependents, and household history will be managed here/);
 assert.doesNotMatch(source,/dossier-parenthood-status/);
});
