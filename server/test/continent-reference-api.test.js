import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {continentRoute,continentSummary} from '../src/world-continent.js';

const actor={id:'00000000-0000-0000-0000-000000000001',account_role:'domina'};
const request=b=>Object.assign(Readable.from([Buffer.from(JSON.stringify(b))]),{method:'PUT'});
const settings={original_name:'ilsabard.png',opacity_pct:70,offset_x:0,offset_y:20,width_pct:105,visible:true};
test('reference layer accepts a compressed RIFF WebP without requiring a third-party host',async()=>{
 const calls=[];
 const pool={execute:async(sql,args)=>{calls.push({sql,args});return [{affectedRows:1}]}};
 const bytes=Buffer.alloc(36);bytes.write('RIFF',0);bytes.write('WEBP',8);
 const result=await continentRoute(pool,request({...settings,image_data:'data:image/webp;base64,'+bytes.toString('base64')}),'/world-admin/continent/reference',actor);
 assert.equal(result.status,200);
 assert.equal(calls.length,1);
 assert.match(calls[0].sql,/UPDATE world_continent_reference/);
});
test('reference layer rejects non-WebP payload, out of range alignment and unauthorized editors',async()=>{
 const pool={execute:async()=>{throw Error('no write expected')}};
 let r=await continentRoute(pool,request({...settings,image_data:'data:image/png;base64,AAAA'}),'/world-admin/continent/reference',actor);
 assert.equal(r.status,400);
 r=await continentRoute(pool,request({...settings,width_pct:500}),'/world-admin/continent/reference',actor);
 assert.equal(r.status,400);
 r=await continentRoute(pool,request(settings),'/world-admin/continent/reference',{account_role:'member'});
 assert.equal(r.status,403);
});
test('continent summary includes reference image and active polygon zones',async()=>{
 const db={execute:async sql=>{
  if(sql.includes('FROM world_continent_settings'))return [[{name:'Ilsabard',background_url:''}]];
  if(sql.includes('FROM world_continent_territories'))return [[{zone_id:9,polygon:JSON.stringify([{x:0,y:0},{x:80,y:0},{x:20,y:90}])}]];
  if(sql.includes('FROM world_continent_reference'))return [[{image_data:null,original_name:'',opacity_pct:75,offset_x:0,offset_y:0,width_pct:100,visible:1}]];
  throw Error(sql);
 }};
 const result=await continentSummary(db);
 assert.equal(result.name,'Ilsabard');
 assert.equal(result.reference.opacity_pct,75);
 assert.equal(result.reference.visible,true);
 assert.equal(result.territories[0].zone_id,9);
});


test('staff can designate uploaded artwork as actual campaign ground',async()=>{
 const writes=[];
 const pool={execute:async(sql,args)=>{writes.push({sql,args});return [{affectedRows:1}]}};
 const saved=await continentRoute(pool,request({...settings,use_as_ground:true}),'/world-admin/continent/reference',actor);
 assert.equal(saved.status,200);
 assert.match(writes[0].sql,/use_as_ground=\?/);
 assert.equal(writes[0].args.at(-1),1);
 const rejected=await continentRoute(pool,request({...settings,use_as_ground:'yes'}),'/world-admin/continent/reference',actor);
 assert.equal(rejected.status,400);
});
test('map artwork mode has an additive database migration and separate political overlays',()=>{
 const sql=readFileSync(new URL('../sql/078_continent_artwork_ground.sql',import.meta.url),'utf8');
 const map=readFileSync(new URL('../../src/ContinentStrategyMap.jsx',import.meta.url),'utf8');
 assert.match(sql,/information_schema\.COLUMNS/);
 assert.match(sql,/use_as_ground TINYINT\(1\)/);
 assert.match(map,/artworkGround/);
 assert.match(map,/Use artwork as playable map ground/);
 assert.match(map,/artworkGround\?1:Number\(reference\.opacity_pct\)\/100/);
 assert.match(map,/geometry\.map/);
 assert.match(map,/provinces\.filter/);
});
