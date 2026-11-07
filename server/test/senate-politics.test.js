import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {allocateSeats,senatePoliticsRoute} from '../src/senate-politics.js';
import {generateToken} from '../src/credentials.js';

const parties=[{id:1,votes:40,seats:6},{id:2,votes:30,seats:5},{id:3,votes:20,seats:3},{id:4,votes:10,seats:1}];
function electionFixture(){
 const candidates=parties.flatMap(p=>Array.from({length:15},(_,i)=>({party_id:p.id,account_id:'party-'+p.id+'-candidate-'+i})));
 const ballots=parties.flatMap(p=>Array.from({length:p.votes},(_,i)=>({party_id:p.id,candidate_id:i===0?'party-'+p.id+'-candidate-0':null})));
 return {candidates,ballots};
}
test('15 elected seats are allocated by Hare quota and largest remainders',()=>{
 const data=electionFixture();
 const result=allocateSeats(data.ballots,data.candidates);
 assert.deepEqual(result.distribution.map(d=>[d.party_id,d.seats]),[[1,6],[2,5],[3,3],[4,1]]);
 assert.equal(result.winners.length,15);
 assert.equal(result.vacant,0);
 assert.equal(new Set(result.winners.map(w=>w.candidate_id)).size,15);
});
test('allocation never gives more seats than candidates or creates votes',()=>{
 const candidates=[{party_id:1,account_id:'only-one'},{party_id:2,account_id:'opposition'}];
 const ballots=[...Array(90).fill({party_id:1}),...Array(10).fill({party_id:2})];
 const result=allocateSeats(ballots,candidates);
 assert.equal(result.winners.length,2);
 assert.equal(result.vacant,13);
 assert.equal(result.distribution.find(p=>p.party_id===1).seats,1);
 assert.equal(allocateSeats([],candidates).winners.length,0);
});
test('an inactive Senate cannot accept election or party writes',async()=>{
 const token=generateToken();
 const pool={execute:async sql=>{
  if(sql.startsWith('SELECT a.id,a.email'))return [[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',account_role:'domina',auth_method:'discord'}]];
  if(sql.startsWith('SELECT enabled FROM order_senate_settings'))return [[{enabled:0}]];
  throw new Error('Unexpected SQL: '+sql);
 }};
 const req={method:'POST',headers:{authorization:'Bearer '+token}};
 const r=await senatePoliticsRoute(pool,req,'/governance/senate/elections');
 assert.deepEqual(r,{status:409,body:{error:'senate_not_convened'}});
});
test('political tables are additive and preview never seeds party or election records',async()=>{
 const sql=await readFile(new URL('../sql/040_senate_politics.sql',import.meta.url),'utf8');
 for(const table of ['order_senate_parties','order_senate_elections','order_senate_candidates','order_senate_election_ballots','order_senate_election_results','order_senate_coalitions','order_senate_coalition_parties'])assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
 assert.doesNotMatch(sql,/INSERT INTO order_senate_parties|INSERT INTO order_senate_elections|DROP TABLE|DELETE FROM/i);
 assert.match(sql,/UNIQUE KEY uq_election_winner/);
});
