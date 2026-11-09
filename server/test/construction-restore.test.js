import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoredConstructionState} from '../src/construction.js';

const stage=status=>({status});
test('archived construction projects restore prior lifecycle without reopening active deliveries',()=>{
 assert.equal(restoredConstructionState('open',[stage('active')]),'paused');
 assert.equal(restoredConstructionState('paused',[stage('active')]),'paused');
 assert.equal(restoredConstructionState('draft',[stage('locked')]),'draft');
 assert.equal(restoredConstructionState('completed',[stage('complete')]),'completed');
});
test('legacy archives infer safe lifecycle from unchanged construction stages',()=>{
 assert.equal(restoredConstructionState(null,[stage('locked')]),'draft');
 assert.equal(restoredConstructionState(null,[stage('active'),stage('locked')]),'paused');
 assert.equal(restoredConstructionState(null,[stage('complete'),stage('active')]),'paused');
 assert.equal(restoredConstructionState(null,[stage('complete'),stage('complete')]),'completed');
 assert.equal(restoredConstructionState(null,[]),null);
});
test('archived project restoration has server-side permissions and transactional locking',()=>{
 const server=readFileSync(new URL('../src/construction.js',import.meta.url),'utf8');
 assert.match(server,/activate\|pause\|resume\|archive\|restore/);
 assert.match(server,/SELECT id,state,pre_archive_state,created_by FROM order_construction_projects WHERE id=\? FOR UPDATE/);
 assert.match(server,/project_director_required/);
 assert.match(server,/if\(action==='restore'\)/);
 assert.match(server,/pre_archive_state=NULL/);
});
test('construction ledger exposes archived work and explicit restore action',()=>{
 const ui=readFileSync(new URL('../../src/ConstructionProjects.jsx',import.meta.url),'utf8');
 assert.match(ui,/View archived projects/);
 assert.match(ui,/Restore archived project/);
 assert.match(ui,/stageAction\('restore'\)/);
 assert.match(ui,/project\.can_edit&&!readOnly/);
});
test('construction migration only adds prior state and leaves existing project contents intact',()=>{
 const sql=readFileSync(new URL('../sql/084_construction_archive_restore.sql',import.meta.url),'utf8');
 assert.match(sql,/ADD COLUMN pre_archive_state/);
 assert.match(sql,/schema_migrations/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM order_construction|UPDATE order_construction/i);
});
