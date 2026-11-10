import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('Supply Command renders with missing optional sources without crashing the whole site',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 try{
  const {default:SupplyCommand}=await vite.ssrLoadModule('/src/LogisticsCommandOverview.jsx');
  const output=renderToStaticMarkup(React.createElement(SupplyCommand,{
   request:async()=>({}),freight:{facilities:[],shipments:[],stocks:[],npc_routes:[],npc_shipments:[],npc_warehouse:[],npc_trades:[]},
   onNavigate:()=>{},onTab:()=>{},onPlanSupply:()=>{},openShipment:()=>{}
  }));
  assert.match(output,/Supply priorities/);
  assert.match(output,/Territorial supply network/);
  assert.match(output,/Industry &amp; restoration/);
 }finally{await vite.close()}
});
