import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/member-rp-profiles.sql',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/InlineSheetEditor.jsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.jsx',import.meta.url),'utf8');

test('member RP profiles are private by default, with server-enforced RPCs',()=>{
 assert.match(sql,/share_content boolean not null default false/);
 assert.match(sql,/share_kinks boolean not null default false/);
 assert.match(sql,/alter table public\.order_member_rp_profiles enable row level security/);
 assert.match(sql,/revoke all on public\.order_member_rp_profiles from public,anon,authenticated/);
 assert.match(sql,/where p\.user_id=auth\.uid\(\)/);
 assert.match(sql,/auth\.uid\(\),normalized_name,p_share_content,p_share_kinks/);
});
test('public member directory returns only member opt-ins',()=>{
 assert.match(sql,/case when p\.share_content then coalesce\(c\.content_preferences/);
 assert.match(sql,/case when p\.share_kinks then p\.kink_entries/);
 assert.match(sql,/where \(p\.share_content or p\.share_kinks\)/);
 assert.doesNotMatch(sql,/['"]email['"]/);
 assert.doesNotMatch(sql,/['"]adult_declaration['"]/);
});
test('kink ratings validate Favorite Yes Maybe No',()=>{
 assert.match(sql,/coalesce\(choice,''\) not in \('favorite','yes','maybe','no'\)/);
 assert.match(sql,/jsonb_array_length\(p_entries\)>60/);
 assert.match(sql,/length\(title\) not between 1 and 80/);
});
test('editor is inline on existing sheet and modal is new-character only',()=>{
 assert.match(dashboard,/editor\?\.id&&selected\?\.id===editor\.id&&canEdit\(selected\)\?<InlineSheetEditor/);
 assert.match(dashboard,/editor && !editor\.id && <div className="modal-backdrop"/);
 assert.match(dashboard,/normalize\(\{\.\.\.candidate,id,name:candidate\.name\.trim\(\)\},0\)/);
 assert.match(editor,/Character Dossier|CHARACTER DOSSIER/);
 assert.match(editor,/Save changes/);
});
test('SQL function delimiter structure is balanced and transaction closed',()=>{
 const starts=[...sql.matchAll(/\bas \$([a-z0-9]+)\$/gi)].map(x=>x[1]);
 const ends=[...sql.matchAll(/^\$([a-z0-9]+)\$;/gmi)].map(x=>x[1]);
 assert.deepEqual(starts,ends);
 assert.match(sql,/^begin;/m);
 assert.match(sql,/commit;\s*$/);
});
