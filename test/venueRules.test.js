import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('App.jsx');
const site=read('src/VenueSite.jsx');
const rules=read('src/VenueRules.jsx');
const menu=read('src/VenueMenu.jsx');
const roster=read('src/VenueRoster.jsx');
const routeGenerator=read('scripts/generate-static-routes.mjs');

test('venue rules have a first-class route and GitHub Pages direct entry point',()=>{
 assert.match(app,/path==='\/venue\/rules'/);
 assert.match(app,/return <VenueRules\/>/);
 assert.match(deployment,/dist\/venue\/rules\/index.html/);
 for(const source of [site,menu,roster])assert.match(source,/href="\/venue\/rules\/"/);
 assert.match(site,/Read the venue rules/);
});

test('rules cover IC conduct, household protocol and OOC participant boundaries',()=>{
 for(const phrase of ['Conduct Within the Eclipse','Respect the Staff','Consent & Boundaries','Violence & Conflict','Substances & Services','Confidentiality','Status & Authority','Guest Interaction','Custodian Authority','Limits & Boundaries','Respect Comes First','Consent Above All','No Godmodding','Keep IC and OOC Separate','Staff Authority','Zero Tolerance Policy']){
  assert.ok(rules.includes(phrase),phrase);
 }
 assert.match(rules,/OOC consent always takes precedence/);
 assert.match(rules,/no ERP/i);
 assert.match(rules,/party chat, or \/tell/);
 assert.match(rules,/No permanent injury, marking, or damage/);
 assert.match(rules,/No ERP, fetish content, or heavy themes without clear out-of-character consent/);
 assert.match(rules,/Friday.*6 PM–2 AM Eastern/);
 assert.match(rules,/Sunday.*6 PM–2 AM Eastern/);
});

test('house rules have accessible landmarks, navigable sections and no required interaction',()=>{
 assert.match(rules,/aria-label="Venue rules navigation"/);
 assert.match(rules,/id="venue-rules-main"/);
 assert.match(rules,/aria-labelledby=\{'rules-heading-'/);
 assert.match(rules,/href="#conduct"/);
 assert.match(rules,/href="#thralls"/);
 assert.match(rules,/href="#ooc"/);
});
