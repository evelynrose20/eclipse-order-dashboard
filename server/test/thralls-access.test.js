import test from 'node:test';
import assert from 'node:assert/strict';
import {mayEnterThralls,canSeatCharacter,withinContributionLimit,lowerMaterialForAnatomy} from '../src/thralls.js';

test('staff can enter without rank queries',async()=>{
 let calls=0;
 const pool={execute:async()=>{calls++;return [[]]}};
 for(const role of ['domina','high_command','handler'])assert.equal(await mayEnterThralls(pool,{id:'staff',account_role:role}),true);
 assert.equal(calls,0);
});
test('household assignments grant access',async()=>{
 const pool={execute:async(sql)=>[sql.includes("track='household'")?[{yes:1}]:[]]};
 assert.equal(await mayEnterThralls(pool,{id:'h',account_role:'member'}),true);
});
test('bound/thrall character ownership grants access',async()=>{
 const pool={execute:async(sql)=>[sql.includes('FROM characters c')?[{yes:1}]:[]]};
 assert.equal(await mayEnterThralls(pool,{id:'t',account_role:'member'}),true);
});
test('ordinary members are denied',async()=>{
 const pool={execute:async()=>[[]]};
 assert.equal(await mayEnterThralls(pool,{id:'m',account_role:'member'}),false);
});

test('chair admission requires offline machine, empty seat and player opt-in',()=>{
 const accepted={allow_seating:1,allow_upper:1,allow_lower:0};
 assert.equal(canSeatCharacter({machine_status:'offline'},{character_id:null},accepted),true);
 assert.equal(canSeatCharacter({machine_status:'standby'},{character_id:null},accepted),false);
 assert.equal(canSeatCharacter({machine_status:'running'},{character_id:null},accepted),false);
 assert.equal(canSeatCharacter({machine_status:'offline'},{character_id:'already-seated'},accepted),false);
 assert.equal(canSeatCharacter({machine_status:'offline'},{character_id:null},{...accepted,allow_seating:0}),false);
});
test('collection limits respect each channel and prior recorded units',()=>{
 const prefs={allow_seating:1,allow_upper:1,allow_lower:0,upper_limit:20,lower_limit:0};
 const seat={upper_recorded:15,lower_recorded:0};
 assert.equal(withinContributionLimit(prefs,seat,'upper',5),true);
 assert.equal(withinContributionLimit(prefs,seat,'upper',6),false);
 assert.equal(withinContributionLimit(prefs,seat,'lower',1),false);
 assert.equal(withinContributionLimit(prefs,seat,'upper',-1),false);
});

test('gender never determines lower reservoir classification',()=>{
 assert.equal(lowerMaterialForAnatomy('vulva'),'vaginal');
 assert.equal(lowerMaterialForAnatomy('penis'),'seminal');
 assert.equal(lowerMaterialForAnatomy('mixed'),'mixed');
 assert.equal(lowerMaterialForAnatomy('other'),'other');
 assert.equal(lowerMaterialForAnatomy('unspecified'),'unclassified');
});
