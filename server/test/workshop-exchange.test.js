import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncWorkshopBuyOrders,workshopDemandProfile} from '../src/workshop-exchange.js';

const migration=readFileSync(new URL('../sql/108_workshop_exchange_demand.sql',import.meta.url),'utf8');
const moduleCode=readFileSync(new URL('../src/workshop-exchange.js',import.meta.url),'utf8');

function mock(){
 const schedules=new Map(),contracts=new Map(),creations=[];
 let next=1;
 const key=(kind,id)=>kind+':'+id;
 const pool={
  query:async sql=>{
   if(sql.includes('FROM fc_materials'))return [[{id:'night-bloom',name:'Night Bloom',category:'botanical'}]];
   if(sql.includes('FROM fc_equipment_templates'))return [[{id:'field-kit',name:'Field Kit',slot:'tool'}]];
   if(sql.includes('FROM order_factions'))return [[{id:'merchant-guild',name:'Merchant Guild'}]];
   if(sql.includes('FROM accounts'))return [[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]];
   throw Error('Unexpected catalog query: '+sql);
  },
  getConnection:async()=>({
   beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
   execute:async(sql,args)=>{
    if(sql.startsWith('INSERT IGNORE INTO fc_trade_auto_demand')){
     const k=key(args[0],args[1]);if(!schedules.has(k))schedules.set(k,{last_contract_id:null,ready:true});
     return [{affectedRows:1}]
    }
    if(sql.startsWith('SELECT last_contract_id'))return [[schedules.get(key(args[0],args[1]))]];
    if(sql.startsWith('SELECT status FROM fc_trade_contracts'))return [[contracts.get(args[0])||null]];
    if(sql.startsWith('SELECT id FROM fc_trade_contracts')){
     const matched=[...contracts].find(([,c])=>c.kind===args[0]&&c.item===args[1]&&['open','paused'].includes(c.status));
     return [matched?[{id:matched[0]}]:[]];
    }
    if(sql.startsWith('INSERT INTO fc_trade_contracts')){
     const id=next++;const kind=args[3],item=args[4]||args[5];
     contracts.set(id,{status:'open',kind,item});creations.push({id,args});
     return [{insertId:id}];
    }
    if(sql.startsWith('UPDATE fc_trade_auto_demand')){
     schedules.set(key(args[1],args[2]),{last_contract_id:args[0],ready:false});
     return [{affectedRows:1}];
    }
    throw Error('Unexpected write: '+sql);
   }
  })
 };
 return {pool,schedules,contracts,creations};
}
test('automatic demand is constrained to Workshop & Garden and retains history',()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS fc_trade_auto_demand/);
 assert.match(migration,/PRIMARY KEY\(item_kind,item_id\)/);
 assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE/i);
 assert.match(moduleCode,/FROM fc_materials/);
 assert.match(moduleCode,/FROM fc_equipment_templates/);
 assert.doesNotMatch(moduleCode,/world_industry_|world_settlements|world_logistics_/);
});
test('material and equipment buy orders auto-create once and never duplicate while active',async()=>{
 const sim=mock();
 assert.equal(await syncWorkshopBuyOrders(sim.pool),2);
 assert.equal(sim.creations.length,2);
 assert.equal(await syncWorkshopBuyOrders(sim.pool),0);
 assert.equal(sim.creations.length,2);
 const material=sim.creations.find(x=>x.args[3]==='material');
 const equipment=sim.creations.find(x=>x.args[3]==='equipment');
 assert.equal(material.args[4],'night-bloom');
 assert.equal(equipment.args[5],'field-kit');
 assert.ok(material.args[6]>0&&material.args[8]>0);
 assert.ok(equipment.args[6]>0&&equipment.args[8]>0);
});
test('finished orders replenish only after cooldown and not while paused',async()=>{
 const sim=mock();
 await syncWorkshopBuyOrders(sim.pool);
 const previous=sim.schedules.get('material:night-bloom').last_contract_id;
 sim.contracts.get(previous).status='complete';
 assert.equal(await syncWorkshopBuyOrders(sim.pool),0);
 sim.schedules.get('material:night-bloom').ready=true;
 assert.equal(await syncWorkshopBuyOrders(sim.pool),1);
 const renewed=sim.schedules.get('material:night-bloom').last_contract_id;
 assert.notEqual(renewed,previous);
 sim.contracts.get(renewed).status='paused';
 sim.schedules.get('material:night-bloom').ready=true;
 assert.equal(await syncWorkshopBuyOrders(sim.pool),0);
});
test('demand values stay within contract quantity, price and reputation limits',()=>{
 for(const id of ['night-bloom','iron-ingot','aether-ink','field-kit']){
  for(const kind of ['material','equipment']){
   const profile=workshopDemandProfile({kind,id,category:'botanical'});
   assert.ok(profile.quantity>=1&&profile.quantity<=100000);
   assert.ok(profile.reputation>=1&&profile.reputation<=20);
   assert.ok(profile.unitPrice>=0&&profile.unitPrice<=100000);
  }
 }
});
