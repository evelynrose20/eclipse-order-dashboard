import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SENATE_SEATS,SENATE_HEADS,senateResult} from '../src/senate.js';

test('the Senate consists of fifteen senatorial seats plus three Heads',()=>{
 assert.equal(SENATE_SEATS,15);
 assert.equal(SENATE_HEADS,3);
 assert.equal(SENATE_SEATS+SENATE_HEADS,18);
});

test('an eighteen-member chamber counts every Head and senator toward quorum',()=>{
 const ballots=[...Array(8).fill('yes'),...Array(2).fill('no')];
 assert.equal(senateResult(ballots,18,9).passed,true);
 assert.equal(senateResult(ballots.slice(0,8),18,9).passed,false);
});

test('Council is explicitly superseded by a convened Senate',async()=>{
 const route=await readFile(new URL('../src/governance-live.js',import.meta.url),'utf8');
 assert.match(route,/senateMode\?\.enabled/);
 assert.match(route,/senate_is_governing_chamber/);
});

test('the Senate retains fifteen fixed positions and disabled default',async()=>{
 const sql=await readFile(new URL('../sql/036_senate_governing_chamber.sql',import.meta.url),'utf8');
 assert.match(sql,/BETWEEN 1 AND 15/);
 assert.match(sql,/head_number IN \(2,3\)/);
 assert.match(sql,/order_senators WHERE active=1/);
});
