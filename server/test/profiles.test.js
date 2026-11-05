import test from 'node:test';
import assert from 'node:assert/strict';
import {profileRoute} from '../src/profiles.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function req(method='GET',body){
 return {method,headers:{authorization:'Bearer '+('T'.repeat(48))},
 [Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}};
}
function pool(role='member'){
 const statements=[];
 const db={
  execute:async(sql,args)=>{
   statements.push({sql,args});
   if(sql.startsWith('SELECT a.id'))return [[{id,account_role:role}]];
   if(sql.startsWith('SELECT adult_declaration'))return [[{adult_declaration:1,content_preferences:{romance:true,violence:false}}]];
   if(sql.startsWith('SELECT display_name'))return [[{display_name:'Private',share_content:false,share_kinks:false,kink_entries:[{label:'confidential',rating:'no'}]}]];
   return [[{affectedRows:1}]];
  },
  query:async(sql)=>{
   statements.push({sql});
   if(sql.startsWith('SELECT p.display_name'))return [[
    {display_name:'A',share_content:0,share_kinks:1,kink_entries:[{label:'Visible',rating:'no'}],content_preferences:{sexual_themes:true}},
    {display_name:'B',share_content:1,share_kinks:0,kink_entries:[{label:'Secret',rating:'favorite'}],content_preferences:{horror:false}}
   ]];
   return [[]];
  }
 };
 return {db,statements};
}
test('private preferences belong only to the signed-in account',async()=>{
 const p=pool();
 const r=await profileRoute(p.db,req('GET'),'/profile/preferences');
 assert.equal(r.status,200);
 assert.equal(r.body.content_preferences.romance,true);
 assert.equal(p.statements[1].args[0],id);
});
test('sharing is independently opt-in per content category and kink list',async()=>{
 const p=pool();
 const r=await profileRoute(p.db,req('GET'),'/profile/directory');
 assert.equal(r.status,200);
 assert.equal(r.body[0].content_preferences,null);
 assert.equal(r.body[0].kink_entries[0].label,'Visible');
 assert.equal(r.body[1].kink_entries,null);
 assert.equal(r.body[1].content_preferences.horror,false);
});
test('member cannot write FC guidance; only command can',async()=>{
 const p=pool();
 const no=await profileRoute(p.db,req('PUT',{key:'welcome',content:'Changed'}),'/settings');
 assert.equal(no.status,403);
 assert.equal(p.statements.length,1);
 const allowed=pool('domina');
 const yes=await profileRoute(allowed.db,req('PUT',{key:'welcome',content:'Hello'}),'/settings');
 assert.equal(yes.status,200);
});
test('reject malformed opt-in lists and unsupported categories',async()=>{
 const p=pool();
 const r=await profileRoute(p.db,req('PUT',{adult_declaration:true,content_preferences:{unapproved_category:true}}),'/profile/preferences');
 assert.equal(r.status,400);
 const k=await profileRoute(p.db,req('PUT',{display_name:'A',share_content:false,share_kinks:true,kink_entries:[{label:'Entry',rating:'not_valid'}]}),'/profile/rp');
 assert.equal(k.status,400);
});
