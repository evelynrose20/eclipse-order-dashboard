import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const publicSite=read('src/PublicSite.jsx');
const chapters=read('src/PublicChronicles.jsx');
const archive=read('src/LoreArchive.jsx');
const sql=read('server/sql/039_garlean_history_revision.sql');
test('public history uses Rosa and current imperial canon',()=>{
 assert.match(publicSite,/AN ORDER/);
 assert.match(publicSite,/BUILT IN SHADOW/);
 assert.match(publicSite,/Domina Rosa/);
 assert.match(publicSite,/New Cassia/);
 assert.doesNotMatch(publicSite,/Elira|Thirteenth|Yanxia/i);
});
test('public chronicle retires obsolete founding claims and keeps stable era keys',()=>{
 assert.match(chapters,/Imperial Foundations/);
 assert.match(chapters,/The Imperial Ambition/);
 assert.match(chapters,/Domina|Rosa/);
 assert.doesNotMatch(chapters.replaceAll('origins-thirteenth','').replaceAll('yanxia-order',''),/Elira|Thirteenth|Yanxia/i);
 assert.match(chapters,/const CHAPTERS=\['garlemald'/);
 assert.match(archive,/\['garlemald','Origins & Garlean Ties'\]/);
});
test('migration corrects only original seed titles and preserves edited history',()=>{
 assert.match(sql,/id='origins-thirteenth' AND updated_by IS NULL/);
 assert.match(sql,/id='carteneau-crossing' AND updated_by IS NULL/);
 assert.match(sql,/born in Garlemald/i);
 assert.match(sql,/Dalamud/);
 assert.match(sql,/Vy’lana/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM order_lore_entries/i);
});
