import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';

test('existing railway terminals have a Manage action with no loss of station information',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 try{
  const {default:RailAccessControls}=await vite.ssrLoadModule('/src/RailAccessControls.jsx');
  const markup=renderToStaticMarkup(React.createElement(RailAccessControls,{
   data:{rail_terminals:[
    {id:1,name:'Moonlight cargo station',stop_type:'settlement',stop_id:12,status:'damaged',platforms:2,notes:'Repairs needed'},
    {id:2,name:'Vali cargo station',stop_type:'settlement',stop_id:19,status:'damaged',platforms:1,notes:''}
   ],rail_service_records:[]},request:async()=>({}),onRefresh:async()=>{},onClose:()=>{}
  }));
  assert.match(markup,/Moonlight cargo station/);
  assert.match(markup,/Vali cargo station/);
  assert.equal((markup.match(/>Manage<\/button>/g)||[]).length,2);
  assert.match(markup,/record its repair/);
 }finally{await vite.close()}
});
test('station editing preserves associated stop and uses the authorized internal rail PUT route',()=>{
 const ui=readFileSync(new URL('../src/RailAccessControls.jsx',import.meta.url),'utf8');
 const api=readFileSync(new URL('../server/src/internal-rail.js',import.meta.url),'utf8');
 assert.match(ui,/stop_type:st\.stop_type,stop_id:st\.stop_id/);
 assert.match(ui,/\/internal-rail\/stations\/'.*editing\.id/);
 assert.match(ui,/platforms:Number\(editing\.platforms\)/);
 assert.match(ui,/await onRefresh\(\)/);
 assert.match(api,/if\(!\['domina','high_command'\]\.includes\(actor\.account_role\)\)/);
 assert.match(api,/old\.stop_type!==b\.stop_type\|\|Number\(old\.stop_id\)!==Number\(b\.stop_id\)/);
});

test('Railway Access exposes station creation while keeping the existing terminal manager',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 try{
  const {default:RailAccessControls}=await vite.ssrLoadModule('/src/RailAccessControls.jsx');
  const markup=renderToStaticMarkup(React.createElement(RailAccessControls,{
   data:{rail_terminals:[{id:7,name:'Moonlight cargo station',stop_type:'settlement',stop_id:12,status:'damaged',platforms:2,notes:''}],rail_service_records:[]},
   request:async()=>({stops:[]}),onRefresh:async()=>{},onClose:()=>{}
  }));
  assert.match(markup,/Add station/);
  assert.match(markup,/Moonlight cargo station/);
  assert.match(markup,/>Manage<\/button>/);
 }finally{await vite.close()}
});
test('new stations use the existing authorized POST API with Order-only stop selections',()=>{
 const ui=readFileSync(new URL('../src/RailAccessControls.jsx',import.meta.url),'utf8');
 const api=readFileSync(new URL('../server/src/internal-rail.js',import.meta.url),'utf8');
 assert.match(ui,/request\('\/internal-rail'\)/);
 assert.match(ui,/setStops\(result\.stops\|\|\[\]\)/);
 assert.match(ui,/newRecord\?'POST':'PUT'/);
 assert.match(ui,/\/internal-rail\/stations'\+\(editing\.id\?/);
 assert.match(ui,/Station location/);
 assert.match(api,/allowedStop\(available,b\.stop_type,b\.stop_id\)/);
 assert.match(api,/INSERT INTO order_internal_rail_stations/);
});
test('standing supply orders display road, rail and air modes, not trains alone',()=>{
 const ui=readFileSync(new URL('../src/LogisticsSupplyLines.jsx',import.meta.url),'utf8');
 const route=readFileSync(new URL('../server/src/world-standing-supply-lines.js',import.meta.url),'utf8');
 for(const mode of ['road','rail','air'])assert.match(ui,new RegExp(mode));
 assert.match(ui,/Road convoys need a connected road route/);
 assert.match(ui,/Air supply lines need operational airship docks/);
 assert.match(route,/\['road','rail','air'\]/);
});
