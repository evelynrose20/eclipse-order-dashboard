import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const homepage=read('src/PublicSite.jsx');
const portal=read('src/OrderNavigation.jsx');
const login=read('src/LocalAccounts.jsx');
const index=read('index.html');
const routes=read('scripts/generate-static-routes.mjs');
const enterprises=read('src/Fronts.jsx');
const territories=read('src/territory-ownership.js');
const migration=read('server/sql/133_imperium_noctis_rebrand.sql');
const setup=read('server/src/setup-local.js');

test('all primary public and member entry points show Imperium Noctis',()=>{
 for(const [name,source] of [['home',homepage],['portal',portal],['login',login],['html',index],['metadata',routes]])
  assert.match(source,/Imperium Noctis|IMPERIUM NOCTIS/,name);
 for(const source of [homepage,portal,login,index,routes,enterprises])
  assert.doesNotMatch(source,/The Eclipse Order|THE ECLIPSE ORDER|Eclipse Order|ECLIPSE ORDER/);
 assert.match(index,/"name": "Imperium Noctis"/);
 assert.match(enterprises,/A licensed enterprise supporting Imperium Noctis/);
});

test('rebrand keeps website and ownership identifiers compatible',()=>{
 assert.match(homepage,/href="\?portal"/);
 assert.match(territories,/owner==='eclipse-order'/);
 assert.match(enterprises,/request\('\/fronts'/);
 assert.match(routes,/\/eclipse-order-dashboard/);
 assert.match(migration,/WHERE id='eclipse-order' AND name IN/);
 assert.match(migration,/name='Imperium Noctis'/);
 assert.match(migration,/UPDATE order_public_faq/);
 assert.match(migration,/UPDATE order_lore_entries/);
 assert.match(setup,/133_imperium_noctis_rebrand\.sql/);
});
