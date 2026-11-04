import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RANKS} from '../src/data/initialData.js';

const sql=readFileSync(new URL('../supabase/events-roster.sql',import.meta.url),'utf8');

test('bound character ranks match the four requested names',()=>{
 const expected=[
  'Rank I: Fresh Intake / Unbroken',
  'Rank II: Initiate / Indentured',
  'Rank III: Trusted / Specialized',
  'Rank IV: Elite / Favor of the Domina'
 ];
 assert.deepEqual(Object.keys(RANKS).filter(name=>name.startsWith('Rank ')),expected);
 assert.ok('Unbound: Free' in RANKS);
});

test('event migration is transactional and has valid function delimiters',()=>{
 assert.match(sql,/\bbegin;\s*$/m);
 assert.match(sql,/\bcommit;\s*$/);
 const functions=[...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map(x=>x[1]);
 assert.equal(new Set(functions).size,functions.length,'Duplicate RPC declarations');
 const starts=[...sql.matchAll(/\bas \$([a-z0-9]+)\$/gi)].map(x=>x[1]);
 const ends=[...sql.matchAll(/^\$([a-z0-9]+)\$;/gmi)].map(x=>x[1]);
 assert.deepEqual(starts,ends,'Broken or truncated SQL function body');
});

test('event signup rules enforce ownership, approval and RLS',()=>{
 assert.match(sql,/alter table public\.order_event_signups enable row level security/i);
 assert.match(sql,/revoke all on public\.order_event_signups from anon,authenticated,public/i);
 assert.match(sql,/owner_user is distinct from auth\.uid\(\)/i);
 assert.match(sql,/s\.status='approved'/i);
 assert.match(sql,/Only approved event applicants can be added/i);
 assert.match(sql,/order_withdraw_event_signup/);
});

test('reversible binding keeps full sheet and uses updated intake name',()=>{
 assert.match(sql,/order_apply_status/);
 assert.match(sql,/Rank I: Fresh Intake \/ Unbroken/);
 assert.match(sql,/Unbound: Free/);
 assert.match(sql,/verified_status_change/);
});
