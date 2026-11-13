import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('App.jsx'),site=read('src/VenueSite.jsx'),roster=read('src/VenueRoster.jsx'),css=read('src/venue-roster.css'),routes=read('scripts/generate-static-routes.mjs');
const people=JSON.parse(read('public/venue-roster.json'));

test('retired venue people page has no public entrypoint but legacy source remains',()=>{
 assert.doesNotMatch(app,/path==='\/venue\/people'/);
 assert.doesNotMatch(app,/return <VenueRoster\/>/);
 assert.doesNotMatch(routes,/route: '\/venue\/people'/);
 assert.match(site,/href="\/venue\/people\/"/);
});
test('public editable roster has distinct staff and thrall entries with unique identifiers',()=>{
 assert.ok(Array.isArray(people.staff));assert.ok(Array.isArray(people.thralls));
 assert.equal(people.staff.length,4);assert.equal(people.thralls.length,4);
 const ids=[...people.staff,...people.thralls].map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(people.staff.some(x=>x.name==='Elira Sakurai'));
 assert.ok(people.staff.some(x=>x.name==='Kaede Akazaya'));
 for(const entry of [...people.staff,...people.thralls]){
  for(const key of ['id','name','title','description','image'])assert.equal(typeof entry[key],'string',entry.id+' '+key);
 }
});
test('public roster gracefully handles unavailable data and missing portraits',()=>{
 assert.match(roster,/fetch\('\/venue-roster.json'/);
 assert.match(roster,/cache:'no-store'/);
 assert.match(roster,/currentTarget|setImageError\(true\)/);
 assert.match(roster,/role="alert"/);
 assert.match(roster,/\/venue-images\//);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.doesNotMatch(roster,/localStorage|sessionStorage|password/i);
});
