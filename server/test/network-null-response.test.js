import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleTransportGraph} from '../src/world-route-network.js';

test('unrecognized transport-network endpoints return 404, never null',async()=>{
 for(const path of ['/world-admin/network/unknown','/world-admin/network/nodes/not-a-number','/world-admin/network/segments/12/invalid']){
  const response=await handleTransportGraph(null,{method:'GET'},path,null);
  assert.deepEqual(response,{status:404,body:{error:'network_route_not_found'}});
 }
});

test('HTTP dispatch guards a null handler response before redirect and status access',async()=>{
 const server=await readFile(new URL('../src/server.js',import.meta.url),'utf8');
 const fallback=server.indexOf('if(result==null)');
 const redirect=server.indexOf('if(result.redirect)');
 const status=server.indexOf('res.writeHead(result.status');
 assert.ok(fallback>0&&fallback<redirect&&redirect<status,'fallback must precede response dereferences');
 assert.match(server,/status:404,body:\{error:'not_found'\}/);
});
