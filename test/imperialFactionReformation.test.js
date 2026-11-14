import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const homepage=read('src/PublicSite.jsx');
const chronicles=read('src/PublicChronicles.jsx');
const workspace=read('src/LocalWorkspace.jsx');
const navigation=read('src/OrderNavigation.jsx');
const enterprises=read('src/Fronts.jsx');
const world=read('src/WorldAdministration.jsx');
const app=read('App.jsx');
const routes=read('scripts/generate-static-routes.mjs');

test('public identity is imperial, antagonist-oriented and not a criminal syndicate',()=>{
 assert.match(homepage,/imperial villain faction/i);
 assert.match(homepage,/BUILDING AN <em>EMPIRE/);
 assert.match(homepage,/imperial officers, spies, magitek researchers/);
 assert.doesNotMatch(homepage,/criminal syndicate|criminal enterprise|criminal families|underworld|smugglers/i);
});

test('current canon names Domina Rosa and retires obsolete origins',()=>{
 assert.match(homepage,/Domina Rosa/);
 assert.match(chronicles,/Imperial Foundations/);
 assert.match(chronicles,/The Imperial Ambition/);
 assert.match(chronicles,/New Cassia serves as the Imperium’s administrative and military center/);
 assert.doesNotMatch(homepage+chronicles.replaceAll('origins-thirteenth','').replaceAll('yanxia-order',''),/Elira|Thirteenth|Yanxia/i);
});

test('member portal exposes enterprises but retains existing API and record identifiers',()=>{
 assert.match(workspace,/\['fronts','Imperial Enterprises'/);
 assert.match(navigation,/IMPERIAL COMMAND/);
 assert.match(enterprises,/<h2>Imperial Enterprises<\/h2>/);
 assert.match(enterprises,/request\('\/fronts'/);
 assert.match(enterprises,/directory\.fronts/);
 assert.match(enterprises,/order_share_percent/);
});

test('world administration preserves distinct control and occupation and retired venue stays off routes',()=>{
 assert.match(world,/Control and occupation are tracked separately/);
 assert.match(app,/if\(memberRoute\)return <LocalAccounts\/>/);
 assert.doesNotMatch(app,/return <VenueSite\/>/);
 assert.doesNotMatch(routes,/route: '\/venue/);
});
