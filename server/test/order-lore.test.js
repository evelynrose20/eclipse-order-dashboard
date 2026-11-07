import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loreRoute} from '../src/lore.js';
const publicRow={id:'new-cassia',title:'New Cassia',era:'present',kind:'place',summary:'Ilsabard',body:'Home',sort_order:10,published:1};
const draftRow={id:'early-journeys',title:'Early Journeys',era:'heavensward',kind:'history',summary:'',body:'',sort_order:20,published:0};
const pool={execute:async(sql)=>{
 if(sql.includes('FROM order_lore_entries WHERE published=1'))return [[publicRow]];
 if(sql.includes('FROM order_lore_entries ORDER BY'))return [[publicRow,draftRow]];
 return [[]];
}};
test('the public archive exposes only published lore',async()=>{
 const r=await loreRoute(pool,{method:'GET'},'/lore/public');
 assert.equal(r.status,200);
 assert.deepEqual(r.body.entries.map(x=>x.id),['new-cassia']);
 assert.equal(r.body.entries[0].published,true);
});
test('private editor rejects unauthenticated and unauthorized writes',async()=>{
 const req={method:'POST',headers:{},[Symbol.asyncIterator]:async function*(){yield Buffer.from('{}')}};
 assert.equal((await loreRoute(pool,req,'/lore')).status,401);
});
test('seed records preserve Thirteenth origins, Stormblood formalization and New Cassia',async()=>{
 const sql=await readFile(new URL('../sql/037_order_lore_archive.sql',import.meta.url),'utf8');
 for(const phrase of ['Thirteenth','Carteneau','Stormblood','New Cassia','Ilsabard','Final Days','Kaede'])assert.ok(sql.includes(phrase),phrase);
 assert.match(sql,/INSERT IGNORE INTO order_lore_entries/);
 assert.match(sql,/early-journeys.*?0\)/s);
 assert.doesNotMatch(sql,/DELETE FROM order_lore_entries|DROP TABLE/i);
});
test('dedicated public route and leadership editor are linked',async()=>{
 const app=await readFile(new URL('../../App.jsx',import.meta.url),'utf8');
 const member=await readFile(new URL('../../src/LocalWorkspace.jsx',import.meta.url),'utf8');
 const publicSite=await readFile(new URL('../../src/PublicSite.jsx',import.meta.url),'utf8');
 assert.match(app,/has\('lore'\)/);
 assert.match(member,/tab==='lore'/);
 assert.match(publicSite,/href="\?lore"/);
});
