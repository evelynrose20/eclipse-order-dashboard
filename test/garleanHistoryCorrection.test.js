import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const publicSite=read('src/PublicSite.jsx');
const chapters=read('src/PublicChronicles.jsx');
const archive=read('src/LoreArchive.jsx');
const sql=read('server/sql/039_garlean_history_revision.sql');
test('public history is an organizational account, not a leader profile',()=>{
 assert.match(publicSite,/AN ORDER/);
 assert.match(publicSite,/BUILT IN SHADOW/);
 assert.match(publicSite,/Born in Garlemald, the Eclipse Order/);
 assert.doesNotMatch(publicSite,/RULED BY ELIRA|personal history reaches back to the Thirteenth|forged beyond any throne/i);
 assert.match(publicSite,/New Cassia/);
});
test('the public chronicle contains no supernatural origins',()=>{
 assert.doesNotMatch(chapters,/Thirteenth|voidsent|voidrift|Flood of Darkness/);
 assert.match(chapters,/Battle of Carteneau/);
 assert.match(chapters,/Dalamud/);
 assert.match(chapters,/Vy’lana/);
 assert.match(chapters,/born in Garlemald/);
 assert.match(chapters,/const CHAPTERS=\['garlemald'/);
 assert.match(archive,/\['garlemald','Garlemald'\]/);
});
test('migration corrects only original seed titles and preserves edited history',()=>{
 assert.match(sql,/id='origins-thirteenth' AND updated_by IS NULL/);
 assert.match(sql,/id='carteneau-crossing' AND updated_by IS NULL/);
 assert.match(sql,/born in Garlemald/i);
 assert.match(sql,/Dalamud/);
 assert.match(sql,/Vy’lana/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM order_lore_entries/i);
});
