import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const get=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('retired economy pages and routes are absent',async()=>{
 const [workspace,backend,setup,legacy]=await Promise.all([
  get('src/LocalWorkspace.jsx'),get('server/src/server.js'),
  get('server/src/setup-local.js'),get('src/Dashboard.jsx')
 ]);
 assert.doesNotMatch(workspace,/EconomyPanel|Black Market|\['market'/);
 assert.doesNotMatch(backend,/economyRoute|\/economy\//);
 assert.doesNotMatch(setup,/006_economy\.sql/);
 assert.doesNotMatch(legacy,/Black Market|SHOP_ITEMS|\['market'|TOTAL RECORDED GIL|Ration & privileges/);
});
test('player-facing pages do not display development instructions',async()=>{
 const pages=['src/LocalWorkspace.jsx','src/LocalAccounts.jsx','src/FCSettings.jsx','src/ProfileConsent.jsx','src/BattleMap.jsx'];
 const text=(await Promise.all(pages.map(get))).join('\n');
 assert.doesNotMatch(text,/run the newest Supabase|Create member accounts in Supabase|Character saved in MySQL|Windows workspace|Local MySQL|Black Market & treasury/i);
});
