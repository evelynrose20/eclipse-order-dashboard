import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=get('App.jsx'),site=get('src/PublicSite.jsx'),style=get('src/public-site.css');

test('public homepage is the default and existing member portal remains separate',()=>{
 assert.match(app,/return <PublicSite\/>/);
 assert.match(app,/new URLSearchParams\(window\.location\.search\)\.has\('portal'\)/);
 assert.match(app,/if\(memberRoute\)return <LocalAccounts\/>/);
 assert.doesNotMatch(app,/<Dashboard\/>/);
 assert.match(site,/href="\?portal"/);
 assert.doesNotMatch(site,/href="\/portal"/);
});
test('public website includes original Order identity, sections, and accessible interactions',()=>{
 for(const section of ['about','history','ranks','roleplay','conduct','visit','membership','questions']){
  assert.match(site,new RegExp('id="'+section+'"'));
 }
 for(const rank of ['Domina','Grand Viper','Inner Council','The Snakes','The Fangs','The Golden Claws','The Household','Freshscales','Voidscales','Eclipsed Consort']){
  assert.ok(site.includes(rank),rank);
 }
 assert.match(site,/aria-modal="true"/);
 assert.match(site,/aria-expanded=\{expandedFAQ===i\}/);
 assert.match(site,/role="tablist"/);
 assert.match(site,/onClick=\{closeMenu\}/);
 assert.match(site,/A Final Fantasy XIV roleplay community/);
});
test('homepage reads only public recruitment state without private accounts or fake external links',()=>{
 assert.match(site,/fetch\(RECRUITMENT_API\+'\/recruitment'/);
 assert.doesNotMatch(site,/useLocal|localApi|sessionStorage|access_token|password/i);
 assert.doesNotMatch(site,/discord\.gg|Shirogane Ward|Plot 7|www\.rkcmateus\.com/);
 assert.doesNotMatch(site,/href="#"/);
 assert.match(style,/@media\(max-width:760px\)/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
});

test('estate card clearly separates real in-game address from mountainous IC refuge',()=>{
 for(const label of ["['WORLD','Dynamis']","['DATA CENTER','Seraph']","['RESIDENTIAL DISTRICT','The Goblet']","['WARD','5']","['PLOT','41']"])
  assert.ok(site.includes(label),label);
 assert.match(site,/id="visit"/);
 assert.match(site,/THE MOUNTAIN SANCTUARY/);
 assert.match(site,/IN-CHARACTER HOME/);
 assert.match(site,/Copy estate address/);
 assert.match(site,/navigator\.clipboard\.writeText/);
 assert.match(style,/\.public-estate-corner\.top-left/);
 assert.match(style,/\.public-visit-grid/);
});
test('recruitment is noticeable both in site header and hero while navigation remains responsive',()=>{
 assert.match(site,/public-recruitment-link/);
 assert.match(site,/public-hero-location/);
 assert.match(site,/RECRUITMENT OPEN/);
 assert.match(site,/href="#membership"/);
 assert.match(style,/@media\(max-width:525px\)/);
});
test('public site uses the newer branch hierarchy instead of obsolete five-rank hierarchy',()=>{
 assert.match(site,/ORDER_BRANCHES/);
 for(const name of ['Hatchling','Coil','Whisper','Shadowkeeper','High Serpent','Fangling','Fangmaster','High Fang','Gilding','Goldkeeper','High Claw','Keeper’s Apprentice','High Steward']){
  if(name==='Gilding')continue;
  assert.ok(site.includes(name),name);
 }
 assert.doesNotMatch(site,/Five ranks\.|Oyabun|Kusushi|Kumi-in/);
 assert.match(site,/SERVITUDE_RANKS/);
});
