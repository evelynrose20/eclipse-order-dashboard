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
