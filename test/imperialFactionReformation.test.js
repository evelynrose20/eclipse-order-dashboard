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

test('historical defaults recognize the Thirteenth household before Stormblood formal ranks',()=>{
 assert.match(chronicles,/The Household and the Thirteenth/);
 assert.match(chronicles,/Formal Order ranks did not exist in these early years/);
 assert.match(chronicles,/fully developed Eclipse Order/);
 assert.match(chronicles,/New Cassia serves as the Order’s administrative and military center/);
});

test('member portal exposes enterprises but retains existing API and record identifiers',()=>{
 assert.match(workspace,/\['fronts','Order Enterprises'/);
 assert.match(navigation,/IMPERIAL COMMAND/);
 assert.match(enterprises,/<h2>Order Enterprises<\/h2>/);
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
