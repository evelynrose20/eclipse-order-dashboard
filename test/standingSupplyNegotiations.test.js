import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supplyLineRoute,runStandingSupplyAutomation} from '../server/src/world-standing-supply-lines.js';
import {npcTreatyDecision,validTreatySchedule,runTreatyNegotiations} from '../server/src/world-treaty-negotiations.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const lines=read('server/src/world-standing-supply-lines.js');
const sql=read('server/sql/105_standing_supply_lines.sql');
const treatySql=read('server/sql/106_timed_trade_negotiations.sql');
const app=read('server/src/world-logistics.js');
const treaties=read('src/LogisticsTradeTreaties.jsx');
const supply=read('src/LogisticsSupplyLines.jsx');
test('standing routes are explicitly controlled and validate all endpoints',async()=>{
 assert.equal((await supplyLineRoute({}, {method:'GET'},'/world-admin/logistics/supply-lines',{account_role:'member'},{})).status,403);
 async function *bad(){yield Buffer.from(JSON.stringify({name:'Empty',source_kind:'invalid',source_id:1,destination_kind:'warehouse',destination_id:3,item_id:'ammo',quantity:10}))}
 assert.equal((await supplyLineRoute({}, {method:'POST',[Symbol.asyncIterator]:bad},'/world-admin/logistics/supply-lines',{account_role:'domina'},{})).status,400);
 assert.deepEqual(await runStandingSupplyAutomation(null),{dispatched:0,arrived:0,waiting:0,disrupted:0});
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_logistics_supply_lines/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_logistics_supply_line_shipments/);
 assert.match(sql,/ENUM\('facility','warehouse'\)/);
 assert.match(sql,/ENUM\('warehouse','installation'\)/);
});
test('continuous logistics cannot invent ammunition, fuel, vehicles or warehouse space',()=>{
 assert.match(lines,/await stock\(db,line.source_kind,line.source_id,line.item_id\)/);
 assert.match(lines,/keep_at_least/);
 assert.match(lines,/await destinationRoom\(db,line,dest\)/);
 assert.match(lines,/await env.availableVehicle/);
 assert.match(lines,/vehicleTemplate.fuel_item_id/);
 assert.match(lines,/fuelAvailable<fuel/);
 assert.match(lines,/shift\(db,line.source_kind,line.source_id,line.item_id,-load/);
 assert.match(lines,/shift\(db,cargo.destination_kind,cargo.destination_id,cargo.item_id,Number\(cargo.quantity\)/);
 assert.match(lines,/status='waiting'/);
 assert.match(lines,/SELECT \?<=UTC_TIMESTAMP\(\) AS due/);
 assert.match(lines,/status='disrupted'/);
 assert.match(lines,/Math\.max\(1,Number\(link.legs\|\|1\)\)\*2/);
 assert.match(app,/runStandingSupplyAutomation\(pool/);
 assert.match(app,/standingRunning/);
 assert.match(read('server/src/world-warehouses.js'),/world_logistics_supply_line_shipments/);
});
test('NPC factions accept, reject and counter based on existing relations',async()=>{
 assert.equal(npcTreatyDecision(70,20).status,'approved');
 assert.equal(npcTreatyDecision(18,20).status,'rejected');
 assert.equal(npcTreatyDecision(70,90).status,'rejected');
 assert.equal(npcTreatyDecision(42,45).status,'countered');
 assert.deepEqual(await runTreatyNegotiations(null),{approved:0,rejected:0,countered:0,activated:0,expired:0});
});
test('date validation prevents invalid and reversed time windows',()=>{
 const iso=ms=>new Date(Date.now()+ms).toISOString();
 assert.equal(validTreatySchedule({response_due_at:iso(3600000),starts_at:iso(86400000),ends_at:iso(604800000)}),true);
 assert.equal(validTreatySchedule({response_due_at:iso(3600000),starts_at:iso(604800000),ends_at:iso(86400000)}),false);
 assert.match(treatySql,/ADD COLUMN response_due_at/);
 assert.match(treatySql,/ADD COLUMN starts_at/);
 assert.match(treatySql,/ADD COLUMN ends_at/);
 assert.match(treatySql,/countered/);
 assert.match(app,/waiting_for_npc_treaty_response/);
 assert.match(app,/runTreatyNegotiations\(pool\)/);
});
test('front-end exposes warehouse network and dated faction bargaining',()=>{
 assert.match(read('src/FreightLogistics.jsx'),/LogisticsSupplyLines/);
 assert.match(supply,/No standing supply routes/);
 assert.match(supply,/Standing Supply Lines/);
 assert.match(supply,/Castrum \/ front line/);
 assert.match(treaties,/type="datetime-local"/);
 assert.match(treaties,/Revise offer/);
 assert.match(treaties,/Likely to refuse/);
 assert.match(read('server/src/setup-local.js'),/105_standing_supply_lines.sql/);
 assert.match(read('server/src/setup-local.js'),/106_timed_trade_negotiations.sql/);
});
