import test from 'node:test';
import assert from 'node:assert/strict';
import {canParticipate} from '../src/encounters.js';
import {eventRoute} from '../src/events.js';

const directorId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const characterId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const event={id:eventId,created_by:directorId,published:1,status:'draft',themes:[],capacity:8};
function request(method,body){
 return {method,headers:{authorization:'Bearer '+('T'.repeat(48))},
  [Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}};
}
test('the encounter director is not automatically a player participant',async()=>{
 const queries=[];
 const pool={execute:async(sql,args)=>{queries.push({sql,args});return [[]]}};
 assert.equal(await canParticipate(pool,{id:directorId,account_role:'domina'},event),false);
 assert.match(queries[0].sql,/order_combatants/);
});
test('linked party member is a participant even without GM powers',async()=>{
 const pool={execute:async()=>[[{present:1}]]};
 assert.equal(await canParticipate(pool,{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',account_role:'member'},event),true);
});
test('event director cannot register their own character in their own event',async()=>{
 const pool={execute:async(sql,args)=>{
  if(sql.startsWith('SELECT a.id'))return [[{id:directorId,account_role:'domina'}]];
  if(sql.startsWith('SELECT * FROM order_encounters'))return [[event]];
  throw Error('No participant writes/reads expected: '+sql);
 }};
 const result=await eventRoute(pool,request('POST',{character_id:characterId}),'/events/'+eventId+'/signups');
 assert.equal(result.status,403);
 assert.equal(result.body.error,'event_director_cannot_join_party');
});
