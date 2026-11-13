import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const publicSite=read('src/PublicSite.jsx');
const chapters=read('src/PublicChronicles.jsx');
const archive=read('src/LoreArchive.jsx');
const sql=read('server/sql/039_garlean_history_revision.sql');
test('public history connects household origins with the later imperial Order',()=>{
 assert.match(publicSite,/AN ORDER/);
 assert.match(publicSite,/BUILT IN SHADOW/);
 assert.match(publicSite,/Elira’s household on the Thirteenth/);
 assert.match(publicSite,/During Stormblood in Yanxia/);
 assert.match(publicSite,/New Cassia/);
});
test('public chronicle reflects Thirteenth household and uses stable era keys',()=>{
 assert.match(chapters,/Thirteenth/);
 assert.match(chapters,/Carteneau/);
 assert.match(chapters,/Dalamud/);
 assert.match(chapters,/formally organized its branches and ranks in Yanxia/);
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
