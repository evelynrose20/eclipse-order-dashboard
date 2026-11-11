import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
test('Escort command exposes moving road rail and air freight alongside supply line movements',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 try{
  const {default:Panel}=await vite.ssrLoadModule('/src/LogisticsEscortsPanel.jsx');
  const result=renderToStaticMarkup(React.createElement(Panel,{
   request:async()=>({}),onRefresh:async()=>{},data:{
    garrisons:[{installation_id:2,installation_name:'Castrum Moonlight',troop_type:'Infantry',quantity:50,state:'operational',condition_pct:100,controlling_faction_id:'eclipse-order',settlement_id:3}],
    facilities:[{id:7,name:'Ammo Foundry',settlement_id:3}],
    escorts:[],engagements:[],
    shipments:[{id:8,status:'in_transit',source_facility_id:7,source_name:'Ammo Foundry',destination_name:'Castrum Vali',item_name:'Ammunition',quantity:35}],
    supply_line_shipments:[{id:19,status:'in_transit',source_kind:'facility',source_id:7,destination_kind:'installation',destination_id:1,item_name:'Rations',quantity:25}],
    military_installations:[{id:1,name:'Castrum Vali'}],warehouses:[]
   }
  }));
  assert.match(result,/Escort command/i);
  assert.match(result,/Ammunition/);
  assert.match(result,/Rations/);
  assert.match(result,/Castrum Moonlight/);
  assert.equal((result.match(/Assign escort/g)||[]).length,2);
  assert.match(result,/Report hostile contact/);
 }finally{await vite.close()}
});
