import test from 'node:test';
import assert from 'node:assert/strict';
import {mayEnterThralls,canSeatCharacter,withinContributionLimit,lowerMaterialForAnatomy,simulatedCycleYield,availableChamberChannels,dailyCapacity,dailyBalance,chamberCycleDate,chamberNextReset} from '../src/thralls.js';

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
 assert.equal(canSeatCharacter({machine_status:'offline'},{character_id:null},{allow_seating:1,allow_upper:0,allow_lower:0}),true,'Seating is independent of collection availability');
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

test('fictional cycle amount comes from physiology, not user-entered limits',()=>{
 assert.equal(simulatedCycleYield('upper',{lactation_state:'none'},0.9),0);
 assert.equal(simulatedCycleYield('upper',{lactation_state:'established'},0.9),3);
 assert.equal(simulatedCycleYield('upper',{lactation_state:'variable'},0),0);
 assert.equal(simulatedCycleYield('lower',{},0.2),0);
 assert.equal(simulatedCycleYield('lower',{},0.9),1);
});

test('vaginal anatomy enables lower collection even with stale stored flag',()=>{
 assert.deepEqual(availableChamberChannels({lower_anatomy:'vulva',lactation_state:'none',allow_lower:0}),{upper:false,lower:true});
 assert.deepEqual(availableChamberChannels({lower_anatomy:'penis',lactation_state:'none',allow_lower:0}),{upper:false,lower:true});
 assert.deepEqual(availableChamberChannels({lower_anatomy:'unspecified',lactation_state:'established',allow_lower:1}),{upper:true,lower:false});
 assert.deepEqual(availableChamberChannels({lower_anatomy:'mixed',lactation_state:'variable'}),{upper:true,lower:true});
});

test('daily capacity follows character profile and is independent for each assembly',()=>{
 assert.equal(dailyCapacity('upper',{lactation_state:'none'}),0);
 assert.equal(dailyCapacity('upper',{lactation_state:'established'}),18);
 assert.equal(dailyCapacity('upper',{lactation_state:'variable'}),8);
 assert.equal(dailyCapacity('lower',{lower_anatomy:'vulva'}),6);
 assert.equal(dailyCapacity('lower',{lower_anatomy:'unspecified'}),0);
 assert.deepEqual(dailyBalance({lactation_state:'established',lower_anatomy:'vulva'},{upper_used:12,lower_used:2}),{
  upper:{maximum:18,used:12,remaining:6},lower:{maximum:6,used:2,remaining:4}
 });
 assert.equal(dailyBalance({lactation_state:'variable',lower_anatomy:'penis'},{upper_used:99,lower_used:99}).lower.remaining,0);
});
test('midnight UTC starts a new daily cycle without changing stored quantities',()=>{
 assert.equal(chamberCycleDate('2026-11-08T23:59:59.999Z'),'2026-11-08');
 assert.equal(chamberCycleDate('2026-11-09T00:00:00.000Z'),'2026-11-09');
 assert.equal(chamberNextReset('2026-11-08T23:59:59.999Z'),'2026-11-09T00:00:00.000Z');
 assert.equal(dailyBalance({lactation_state:'established',lower_anatomy:'vulva'},null).upper.remaining,18);
});
