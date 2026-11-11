import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleStatus,conceptionChance,pregnancyProgress,reproductionRoute} from '../src/character-reproduction.js';
const start={cycle_opt_in:true,conception_opt_in:true,cycle_anchor:'2026-11-01',cycle_days:30,base_chance:20};
const asDate=day=>new Date('2026-11-'+String(day).padStart(2,'0')+'T12:00:00Z');
test('all eight bound ranks are distinct and increase peak intensity and fictional odds',()=>{
 const codes=['unmarked','marked_thrall','bound_serpent','eclipse_attendant','silken_thrall','violet_keeper','serpents_chosen','eclipsed_consort'];
 let last=-1;
 codes.forEach((code,i)=>{
  const c=cycleStatus(start,true,code,asDate(22));
  assert.equal(c.phase,'peak');
  assert.equal(c.rank,i+1);
  assert.ok(c.resonance>last);
  last=c.resonance;
  assert.ok(conceptionChance(start,c)>=20);
 });
});
test('cycle phases are date-derived and unbinding disables resonance without deleting settings',()=>{
 assert.equal(cycleStatus(start,true,'silken_thrall',asDate(1)).phase,'dormant');
 assert.equal(cycleStatus(start,true,'silken_thrall',asDate(12)).phase,'onset');
 assert.equal(cycleStatus(start,true,'silken_thrall',asDate(16)).phase,'active');
 assert.equal(cycleStatus(start,true,'silken_thrall',asDate(22)).phase,'peak');
 assert.equal(cycleStatus(start,true,'silken_thrall',asDate(27)).phase,'recovery');
 assert.equal(cycleStatus(start,false,'silken_thrall',asDate(22)).multiplier,1);
 assert.equal(cycleStatus({...start,cycle_opt_in:false},true,'silken_thrall',asDate(22)).active,true);
});
test('pregnancy progression follows its IC anchor and never automatically decides delivery',()=>{
 const p={pregnancy_status:'active',pregnancy_anchor:'2026-11-01',pregnancy_start_day:35,pregnancy_total_days:280};
 assert.deepEqual(pregnancyProgress(p,asDate(1)),{days:35,week:6,total_days:280,percent:13,due:false});
 assert.equal(pregnancyProgress({...p,pregnancy_status:'completed'},asDate(1)),null);
});
test('conception chance is capped and computed from the agreed baseline',()=>{
 const p={...start,base_chance:80};
 assert.equal(conceptionChance(p,cycleStatus(p,true,'eclipsed_consort',asDate(22))),100);
});
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',character='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request=(method,body)=>({method,headers:{authorization:'Bearer '+'z'.repeat(48)},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body))}});
function mock(owner,profile,role='member'){
 const writes=[];
 const pool={execute:async(sql,args)=>{
  if(sql.startsWith('SELECT a.id'))return [[{id:actor,account_role:role}]];
  if(sql.includes('FROM characters c LEFT JOIN'))return [[{id:character,player_account_id:owner,collar_bound:1,rank_code:'eclipsed_consort'}]];
  if(sql.startsWith('SELECT * FROM character_reproductive_profiles'))return [profile?[profile]:[]];
  if(sql.startsWith('SELECT id,event_key')||sql.startsWith('SELECT action,summary'))return [[]];
  if(sql.startsWith('INSERT INTO character_reproductive_profiles')||sql.startsWith('INSERT INTO character_reproductive_events')){writes.push({sql,args});return [{affectedRows:1}]}
  if(sql.startsWith('SELECT * FROM character_conception_rolls')||sql.startsWith('SELECT id FROM character_conception_rolls'))return [[]];
  throw Error('Unexpected SQL: '+sql)
 },getConnection:async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},execute:async(sql,args)=>{
  if(sql.startsWith('SELECT * FROM character_reproductive_profiles'))return [profile?[profile]:[]];
  if(sql.startsWith('SELECT * FROM character_conception_rolls')||sql.startsWith('SELECT id FROM character_conception_rolls'))return [[]];
  throw Error('Unexpected transaction SQL: '+sql);
 }})};
 return {pool,writes};
}
test('private pregnancy and binding records reject unrelated accounts including rank holders',async()=>{
 const {pool}=mock('cccccccc-cccc-4ccc-8ccc-cccccccccccc',{shared_with_command:0});
 assert.equal((await reproductionRoute(pool,request('GET'),'/characters/'+character+'/reproduction')).status,403);
 assert.equal((await reproductionRoute(pool,request('PUT',{cycle_opt_in:true}),'/characters/'+character+'/reproduction/settings')).status,403);
});
test('bound calendar remains automatic while owner can disable conception rolls',async()=>{
 const {pool,writes}=mock(actor,null);
 const result=await reproductionRoute(pool,request('PUT',{cycle_opt_in:false,conception_opt_in:false,cycle_type:'heat',cycle_anchor:'2026-11-01',cycle_days:30,base_chance:20,shared_with_command:false}),'/characters/'+character+'/reproduction/settings');
 assert.equal(result.status,200);
 assert.equal(writes.length,2);
 assert.equal(writes[0].args[1],1);
 assert.equal(writes[0].args[2],0);
});
test('roll requests are rejected unless the affected owner has opted in',async()=>{
 const {pool}=mock(actor,null);
 const r=await reproductionRoute(pool,request('POST',{event_key:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',ic_event_date:'2026-11-11'}),'/characters/'+character+'/reproduction/roll');
 assert.equal(r.status,403);
 assert.equal(r.body.error,'conception_roll_not_approved');
});

test('Command sees the IC cycle and pregnancy stage without owner sharing',async()=>{
 const {pool}=mock('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  {shared_with_command:0,conception_opt_in:1,pregnancy_status:'active',pregnancy_anchor:'2026-11-01',pregnancy_start_day:14,pregnancy_total_days:280,pregnancy_notes:'private information',cycle_type:'heat',cycle_days:30},'high_command');
 const result=await reproductionRoute(pool,request('GET'),'/characters/'+character+'/reproduction');
 assert.equal(result.status,200);
 assert.equal(result.body.command_view,true);
 assert.equal(result.body.can_edit,false);
 assert.equal(result.body.profile.pregnancy_status,'active');
 assert.equal(result.body.profile.pregnancy_notes,undefined);
 assert.equal(result.body.profile.conception_opt_in,undefined);
 assert.equal(result.body.rolls.length,0);
 assert.equal(result.body.cycle.active,true);
});
test('Command cannot change conception preferences or edit a pregnancy',async()=>{
 const {pool}=mock('cccccccc-cccc-4ccc-8ccc-cccccccccccc',{shared_with_command:0},'domina');
 const result=await reproductionRoute(pool,request('PUT',{cycle_type:'rut',conception_opt_in:false}),'/characters/'+character+'/reproduction/settings');
 assert.equal(result.status,403);
});
test('unbound character has no active magical cycle even if legacy opt in remains',()=>{
 const cycle=cycleStatus({...start,cycle_opt_in:true},false,'eclipsed_consort',asDate(22));
 assert.equal(cycle.active,false);
});
