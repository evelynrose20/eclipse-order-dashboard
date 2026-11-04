import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/battlemap-dice.sql',import.meta.url),'utf8');

test('battlemap migration has one declaration per RPC',()=>{
 const functions=[...sql.matchAll(/create or replace function public\.(\w+)\s*\(/g)].map(x=>x[1]);
 assert.ok(functions.length>=15);
 assert.equal(new Set(functions).size,functions.length,'Duplicate function declarations signal a corrupt migration');
});

test('PL/pgSQL dollar quotes are balanced',()=>{
 const open=[...sql.matchAll(/\bas \$([a-z][a-z0-9]*)\$/gi)].map(m=>m[1]);
 const close=[...sql.matchAll(/^\$([a-z][a-z0-9]*)\$;/gmi)].map(m=>m[1]);
 assert.deepEqual(open,close,'A function body may have been truncated');
});

test('migration is transactional and locks down every new table',()=>{
 assert.match(sql,/^\s*--[\s\S]*\bbegin;/i);
 assert.match(sql,/\bcommit;\s*$/i);
 for(const table of ['order_roll_requests','order_roll_hp_applications']){
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security','i'));
  assert.match(sql,new RegExp('revoke all on public\\.'+table,'i'));
 }
});

test('critical dice RPC and map migration pieces are included',()=>{
 for(const name of ['order_move_token','order_roll_action','order_apply_roll_hp','order_request_dice','order_list_encounter_rolls','order_roll_encounter']){
  assert.match(sql,new RegExp('create or replace function public\\.'+name+'\\s*\\(','i'));
 }
 assert.doesNotMatch(sql,/\$rolls\$;\s*then\b/i,'Stray THEN after function termination');
 assert.doesNotMatch(sql,/\$action\$;\s*then\b/i,'Stray THEN after function termination');
});
