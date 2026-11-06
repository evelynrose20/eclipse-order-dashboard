import test from 'node:test';
import assert from 'node:assert/strict';
import {readableApiError,contextualApiError} from '../src/apiErrors.js';
import {readFileSync} from 'node:fs';
test('all encounter eligibility codes have clear corrective messages',()=>{
 for(const code of ['encounter_not_active','encounter_archived','not_in_encounter_party','rp_declaration_required','event_themes_not_enabled','encounter_participation_paused','finish_encounter_before_archive','archive_before_delete']){
  const msg=readableApiError(code,403);
  assert.ok(msg.length>35,code);
  assert.ok(!msg.includes('_'),code);
 }
});
test('API failures carry a safe action label and preserve server code',()=>{
 const error=contextualApiError('archive_before_delete',{status:409,path:'/encounters/demo',method:'DELETE'});
 assert.equal(error.status,409);
 assert.equal(error.code,'archive_before_delete');
 assert.equal(error.action,'DELETE /encounters/demo');
 assert.match(error.message,/Archive/);
});
test('scene management is only in DM workspace, not member battle map',()=>{
 const dm=readFileSync(new URL('../src/Encounters.jsx',import.meta.url),'utf8');
 const player=readFileSync(new URL('../src/PlayerBattleView.jsx',import.meta.url),'utf8');
 for(const term of ['archiveEncounter','restoreEncounter','deleteEncounter','showArchived','encounter-feedback'])
  assert.ok(dm.includes(term),term);
 for(const term of ['archiveEncounter','restoreEncounter','deleteEncounter'])
  assert.ok(!player.includes(term),term);
});
