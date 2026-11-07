import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const files=[
 'SearchPicker','battlemap','character-dossier','combatant-workspace','commerce',
 'construction','dashboard','dice-tray','discord-access-page','discord-account',
 'encounter-dice','encounter-studio','encounters','event-board','event-planning',
 'factions','fronts','governance-preview','homebrew-classes','inline-sheet',
 'local-accounts','lore-archive','order-navigation','order-sheets',
 'portal-controls','public-chronicles','public-site','rp-platform','rp-profile',
 'senate','shared-login','treasury','workshop'
];
const sources=files.map(name=>({name,css:readFileSync(new URL('../src/'+name+'.css',import.meta.url),'utf8')}));
const oldColors=['#302330','#2d2330','#f7dfeb','#e7b0cc','#dca9b9','#9b6680','#a85e6b','#634456','#2a151b','#d99ba8','#e9d4e2','#e9dce0'];

test('all legacy component stylesheets have been brought into the industrial palette',()=>{
 for(const {name,css} of sources){
  for(const c of oldColors)assert.ok(!css.toLowerCase().includes(c),name+' still includes old color '+c);
  assert.ok(!/border-radius:\s*(?:8|9|10|11|12|13|14|15|16|17|18|20|24|28|30)px/.test(css),name+' has old rounded panel styles');
 }
});
test('important game and management modules share cold steel and crimson colors',()=>{
 for(const name of ['commerce','workshop','fronts','construction','event-board','factions','governance-preview','senate','inline-sheet','character-dossier','dashboard','public-site']){
  const css=sources.find(s=>s.name===name).css;
  assert.match(css,/#(?:202a33|29343e|384651|131b23)/i,name+' missing iron surfaces');
  assert.match(css,/#(?:bd545c|923943|df8584)/i,name+' missing crimson accents');
 }
});
test('public site no longer loads or depends on the old ornamental font set',()=>{
 const css=sources.find(s=>s.name==='public-site').css;
 assert.doesNotMatch(css,/Cormorant\+Garamond|Cormorant Garamond/);
 assert.match(css,/var\(--imperial-heading/);
});
test('status colors remain differentiated for gameplay and member workflows',()=>{
 for(const name of ['workshop','fronts','treasury']){
  const css=sources.find(s=>s.name===name).css;
  assert.match(css,/#(?:a8e2c2|a8e9c2|a8d9|b5d|bee8c9|c2ebce|a8e2|aecfb7|a6d)/i,name+' should retain success styling');
 }
});
