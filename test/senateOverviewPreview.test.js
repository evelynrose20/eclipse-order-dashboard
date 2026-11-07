import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('the Senate can preview the real chamber component while disabled',()=>{
 const senate=load('Senate.jsx');
 assert.match(senate,/setPreview\(v=>!v\)/);
 assert.match(senate,/<SenateChamber preview request=\{request\}\/>/);
 assert.match(senate,/!enabled\?</);
});
test('preview data is isolated from live API and explicitly disclosed',()=>{
 const screen=load('SenateChamber.jsx'),sample=load('senate-preview-data.js');
 assert.match(screen,/CHAMBER PREVIEW — SAMPLE DATA/);
 assert.match(screen,/if\(!canWrite\|\|busy\)return/);
 assert.match(screen,/preview\?\{\.\.\.DEMO_POLITICS/);
 assert.match(sample,/UI-only sample records/);
 assert.match(sample,/seats:split\.map/);
 assert.match(screen,/15 senatorial seats/);
});
test('overview includes parties, election phases, coalitions, bills and history',()=>{
 const screen=load('SenateChamber.jsx');
 for(const label of ['Chamber','Parties','Elections','Coalitions','On the Floor','History','SECRET BALLOT','PROVISIONAL SENATE'])assert.ok(screen.includes(label),label);
 assert.match(screen,/party\?\.color/);
 assert.match(screen,/pol-arc/);
 assert.match(load('senate-chamber.css'),/@media\(max-width:620px\)/);
});
