import test from 'node:test';
import assert from 'node:assert/strict';
import {revokeAccountAccess} from '../src/account-access.js';

function dbFor(target,dominaCount=1){
 const calls=[];
 return {calls,execute:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('FROM accounts WHERE id=? FOR UPDATE'))return [[target]];
  if(sql.includes("COUNT(*) AS total"))return [[{total:dominaCount}]];
  return [{affectedRows:1}];
 }};
}
test('staff revocation immediately disables approved access, existing sessions and writes audit trail',async()=>{
 const db=dbFor({id:'member',account_role:'member',is_active:1,approval_status:'approved'});
 assert.deepEqual(await revokeAccountAccess(db,'member',{actorId:'admin',reason:'staff_removed'}),{status:200});
 assert.ok(db.calls.some(x=>x.sql.includes("is_active=0,approval_status='rejected'")));
 assert.ok(db.calls.some(x=>x.sql.includes('UPDATE account_sessions SET revoked_at')));
 assert.ok(db.calls.some(x=>x.sql.includes('INSERT INTO audit_log')&&x.args[0]==='admin'));
 assert.ok(db.calls.every(x=>!x.sql.startsWith('DELETE')));
});
test('already removed accounts do not generate repeated audit log entries',async()=>{
 const db=dbFor({id:'member',account_role:'member',is_active:0,approval_status:'rejected'});
 assert.equal((await revokeAccountAccess(db,'member')).already_revoked,true);
 assert.equal(db.calls.length,1);
});
test('the last active Domina cannot be automatically or manually removed',async()=>{
 const db=dbFor({id:'owner',account_role:'domina',is_active:1,approval_status:'approved'},0);
 assert.deepEqual(await revokeAccountAccess(db,'owner',{reason:'discord_membership_lost'}),{status:409,error:'cannot_remove_last_domina'});
 assert.ok(!db.calls.some(x=>x.sql.includes('UPDATE account_sessions')));
});
test('departed staff accounts can be revoked when another active Domina remains',async()=>{
 const db=dbFor({id:'former',account_role:'domina',is_active:1,approval_status:'approved'},1);
 assert.equal((await revokeAccountAccess(db,'former',{reason:'discord_membership_lost'})).status,200);
 assert.ok(db.calls.some(x=>x.sql.includes('UPDATE account_sessions')));
});
