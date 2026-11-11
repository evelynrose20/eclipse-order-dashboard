import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('Council appointments use character IDs and explicit Lock In buttons rather than mutable account dropdowns',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 try{
  const {default:Council}=await vite.ssrLoadModule('/src/GovernancePreview.jsx');
  const html=renderToStaticMarkup(React.createElement(Council,{request:async()=>({}),accounts:[],currentUser:{}}));
  assert.match(html,/Governance of the Order/);
  const source=readFileSync(new URL('../src/GovernancePreview.jsx',import.meta.url),'utf8');
  assert.match(source,/character_id/);
  assert.match(source,/Lock In/);
  assert.match(source,/Request removal vote/);
  assert.match(source,/removalReason/);
  assert.doesNotMatch(source,/account_id:e\.target\.value\|\|null/);
 }finally{await vite.close()}
});
test('Council backend prevents free reassignment and only executes voted major removals',()=>{
 const source=readFileSync(new URL('../server/src/governance-live.js',import.meta.url),'utf8');
 assert.match(source,/office_locked_removal_vote_required/);
 assert.match(source,/character_or_owner_already_holds_seat/);
 assert.match(source,/removal_motion_already_active/);
 assert.match(source,/m\.removal_office_code/);
 assert.match(source,/outcome\.passed&&m\.removal_office_code/);
 assert.match(source,/account_id <=> \? AND character_id <=> \?/);
 assert.match(source,/voted_removal/);
 assert.doesNotMatch(source,/b\.account_id\?\s*new Date/);
});
test('Council character migration is additive and does not guess characters for multi-character accounts',()=>{
 const sql=readFileSync(new URL('../server/sql/113_council_character_lock_voted_removal.sql',import.meta.url),'utf8');
 const setup=readFileSync(new URL('../server/src/setup-local.js',import.meta.url),'utf8');
 assert.match(sql,/COUNT\(\*\) AS characters/);
 assert.match(sql,/c\.characters=1/);
 assert.match(sql,/removal_account_id/);
 assert.match(setup,/113_council_character_lock_voted_removal\.sql/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM/i);
});
