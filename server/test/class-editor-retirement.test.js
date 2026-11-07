import test from 'node:test';
import assert from 'node:assert/strict';
import {classRoute,builtinClassCatalog,loadClassCatalog} from '../src/class-catalog.js';
import {generateToken} from '../src/credentials.js';

test('retired class editor cannot create or update class definitions, even as Domina',async()=>{
 const pool={execute:async sql=>{
  if(sql.startsWith('SELECT a.id,a.email'))return [[{id:'11111111-1111-4111-8111-111111111111',account_role:'domina',auth_method:'discord'}]];
  throw new Error('Unexpected query: '+sql);
 }};
 const token=generateToken();
 const req={method:'PUT',headers:{authorization:'Bearer '+token}};
 const result=await classRoute(pool,req,'/classes/custom-knight');
 assert.equal(result.status,404);
 assert.equal(result.body.error,'not_found');
});
test('read-only catalog retains built-in jobs and previously saved class records',async()=>{
 const classes=builtinClassCatalog();
 assert.equal(classes.bastion.name,'Bastion');
 assert.equal(classes.zephyr.name,'Zephyr');
 const sample={...classes.bastion,name:'Archived Character Class'};
 const pool={query:async()=>[[{id:'older-class',definition_json:JSON.stringify(sample)}]]};
 const catalog=await loadClassCatalog(pool);
 assert.equal(catalog['older-class'].name,'Archived Character Class');
 assert.equal(catalog['older-class'].built_in,false);
 assert.ok(catalog.paladin);
});
