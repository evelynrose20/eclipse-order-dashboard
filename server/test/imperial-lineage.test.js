import test from 'node:test';
import assert from 'node:assert/strict';
import {gestationStage,DEVELOPMENT_STAGES} from '../../src/gestationStages.js';
import {lineageRoute} from '../src/imperial-lineage.js';
import {readFileSync} from 'node:fs';

test('six gestation stages follow the actual saved IC pregnancy term',()=>{
 assert.equal(DEVELOPMENT_STAGES.length,6);
 assert.equal(gestationStage(0,90).index,0);
 assert.equal(gestationStage(14,90).index,1);
 assert.equal(gestationStage(24,90).index,2);
 assert.equal(gestationStage(45,90).index,3);
 assert.equal(gestationStage(65,90).index,4);
 assert.equal(gestationStage(90,90).index,5);
 assert.equal(gestationStage(280,280).stage.name,'Birth ready');
 assert.equal(gestationStage(0,280).stage.name,'Conception');
});
test('gestation view uses real pregnancy progress and remains private in dossier',()=>{
 const ui=readFileSync(new URL('../../src/CharacterReproduction.jsx',import.meta.url),'utf8');
 const dossier=readFileSync(new URL('../../src/CharacterDossier.jsx',import.meta.url),'utf8');
 assert.match(ui,/GestationDevelopment days=\{progress\?\.days\|\|0\} totalDays=\{progress\?\.total_days\|\|90\}/);
 assert.match(dossier,/active==='pregnancy'&&personalRecord/);
});
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const charId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const req=(method,body)=>({method,headers:{authorization:'Bearer '+'z'.repeat(48)},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body))}});
function poolFor(role='member',ownerId=uuid){
 const writes=[];
 const db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
  execute:async(sql,args=[])=>{
   if(sql.includes('FROM character_lineage_permissions'))return [[]];
   if(sql.includes('SELECT id FROM order_lineage_projects'))return [[{id:1}]];
   if(sql.startsWith('INSERT INTO character_lineage_permissions')||sql.startsWith('UPDATE order_lineage_cases')){writes.push({sql,args});return [{affectedRows:1}]}
   if(sql.startsWith('INSERT INTO order_lineage_cases')){writes.push({sql,args});return [{insertId:4}]}
   return [[]];
  }};
 return {writes,pool:{
  execute:async(sql,args=[])=>{
   if(sql.startsWith('SELECT a.id'))return [[{id:uuid,account_role:role}]];
   if(sql.startsWith('SELECT id,player_account_id FROM characters'))return [[{id:charId,player_account_id:ownerId}]];
   if(sql.startsWith('SELECT allow_research FROM character_lineage_permissions'))return [[]];
   if(sql.startsWith('SELECT id,title'))return [[]];
   if(sql.includes('FROM order_lineage_cases lc'))return [[]];
   if(sql.startsWith('SELECT c.id,c.character_name'))return [[]];
   throw Error('Unexpected SQL '+sql);
  },getConnection:async()=>db
 }};
}
test('research access is controlled by the character owner, not staff',async()=>{
 const {pool,writes}=poolFor('domina','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 const r=await lineageRoute(pool,req('PUT',{allow_research:true}),'/characters/'+charId+'/lineage-consent');
 assert.equal(r.status,403);assert.equal(writes.length,0);
});
test('the character owner can withdraw research linking; linked cases are detached',async()=>{
 const {pool,writes}=poolFor('member',uuid);
 const r=await lineageRoute(pool,req('PUT',{allow_research:false}),'/characters/'+charId+'/lineage-consent');
 assert.equal(r.status,200);
 assert.ok(writes.some(x=>x.sql.includes('UPDATE order_lineage_cases SET character_id=NULL')));
});
test('ordinary members cannot read restricted research program data',async()=>{
 const {pool}=poolFor('member');
 const r=await lineageRoute(pool,req('GET'),'/thralls/lineage');
 assert.equal(r.status,403);
});
test('staff cannot link a character without its distinct research authorization',async()=>{
 const {pool,writes}=poolFor('high_command');
 const result=await lineageRoute(pool,req('POST',{project_id:1,character_id:charId,designation:'Case One',
  method:'Aetheric study',observations:'',lineage_markers:'',result:'ongoing',pregnancy_linked:false}),'/thralls/lineage/cases');
 assert.equal(result.status,409);
 assert.equal(result.body.error,'character_research_not_authorized');
 assert.ok(!writes.some(w=>w.sql.startsWith('INSERT INTO order_lineage_cases')));
});

test('member lineage endpoint only queries owned, consented character records',async()=>{
 const {pool}=poolFor('member');
 let sqlText='';
 pool.execute=async(sql,args=[])=>{
  if(sql.startsWith('SELECT a.id'))return [[{id:uuid,account_role:'member'}]];
  if(sql.includes('FROM order_lineage_cases lc')&&sql.includes('JOIN characters c ON')){
   sqlText=sql;
   assert.deepEqual(args,[uuid]);
   return [[{id:10,project_id:2,character_id:charId,character_name:'Thrall 001',
    designation:'Trial One',result:'ongoing',lineage_type:'voidsent',subject_role:'carrier',
    expression_stage:'subtle',lineage_markers:'CLASSIFIED SECRET',traits:['skin_tint','void_aether_trace'],
    offspring_traits:['black_scales'],offspring_stage:'anticipated',participant_note:'Minor pigment shift',
    parenthood_note:'Lineage under observation',void_revealed:0,pregnancy_linked:0,pregnancy_status:null}]];
  }
  throw new Error('Unexpected SQL '+sql);
 };
 const response=await lineageRoute(pool,req('GET'),'/thralls/lineage/my');
 assert.equal(response.status,200);
 assert.match(sqlText,/c.player_account_id=\?/);
 assert.match(sqlText,/perm.allow_research=1/);
 assert.equal(response.body.cases.length,1);
 assert.equal(response.body.cases[0].lineage_type,'undisclosed');
 assert.equal(response.body.cases[0].lineage_markers,'');
 assert.deepEqual(response.body.cases[0].traits,['skin_tint']);
 assert.deepEqual(response.body.cases[0].offspring_traits,[]);
 assert.equal(response.body.cases[0].may_conceive,true);
 assert.equal(response.body.cases[0].method,undefined);
 assert.equal(response.body.cases[0].observations,undefined);
});
test('source characters cannot receive descendant physical markers',async()=>{
 const {pool,writes}=poolFor('high_command');
 const response=await lineageRoute(pool,req('POST',{
  project_id:1,character_id:null,designation:'Void source study',
  method:'',observations:'',lineage_markers:'',result:'ongoing',pregnancy_linked:false,
  lineage_type:'voidsent',subject_role:'source',traits:['black_scales']
 }),'/thralls/lineage/cases');
 assert.equal(response.status,400);
 assert.equal(writes.length,0);
});
test('lineage research migration leaves established pregnancies in place',()=>{
 const sql=readFileSync(new URL('../sql/128_lineage_paths.sql',import.meta.url),'utf8');
 assert.match(sql,/ADD COLUMN lineage_case_id BIGINT UNSIGNED NULL/);
 assert.match(sql,/ALTER TABLE order_lineage_cases ADD COLUMN traits JSON NULL/);
 assert.doesNotMatch(sql,/DELETE FROM|DROP TABLE/i);
});
