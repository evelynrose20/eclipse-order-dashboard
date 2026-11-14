import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const site=read('src/PublicSite.jsx');
const css=read('src/imperial-coc.css');
const ranks=read('server/sql/136_garlean_ranks_and_senate_name.sql');
const setup=read('server/src/setup-local.js');
const admin=read('src/LocalWorkspace.jsx');
const servitude=read('src/servitudeRanks.js');

test('imperial command tree has linked command and four operational branches',()=>{
 for(const title of ['Imperatrix','Consul','Senatus Imperialis','Garlean Shadows','The Legions','Officium Aerarii','R&D'])
  assert.ok(site.includes(title),title);
 for(const cls of ['imperial-coc-chain','imperial-coc-fork','imperial-coc-branches','imperial-coc-ranks'])
  assert.ok(site.includes(cls),cls);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(site,/Peregrinus <em>→<\/em> Civis/);
 assert.match(admin,/golden_claws:'Officium Aerarii'/);
 assert.match(admin,/household:'R&D'/);
});

test('rank label migration changes names without changing any stable IDs or the bound path',()=>{
 for(const code of ['domina','grand_viper','inner_council','hatchling','high_serpent','high_fang','goldkeeper','high_claw','keepers_apprentice','high_steward','freshscales','voidscales'])
  assert.match(ranks,new RegExp("WHEN '"+code+"' THEN"));
 assert.match(ranks,/WHERE track IN \('leadership','snakes','fangs','golden_claws','household','membership'\)/);
 assert.doesNotMatch(ranks,/UPDATE account_order_ranks|UPDATE character_order_ranks|WHERE track='servitude'/);
 assert.match(setup,/136_garlean_ranks_and_senate_name\.sql/);
 assert.match(site,/SERVITUDE_RANKS\.map/);
 assert.match(ranks,/Primus Frumentarius/);
 assert.match(ranks,/Legatus Legionis/);
 assert.match(ranks,/Primus Architectus Magiteci/);
 assert.match(servitude,/Eclipsed Consort/);
});
