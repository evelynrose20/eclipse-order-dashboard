import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const logistics=read('server/src/world-logistics.js');
const setup=read('server/src/setup-local.js');
const sql=read('server/sql/102_airship_landing_facilities.sql');
const panel=read('src/LogisticsAirDocks.jsx');
const workspace=read('src/FreightLogistics.jsx');

test('landing facilities are persistent and paid for with local industrial materials',()=>{
 assert.match(sql,/world_logistics_air_docks/);
 assert.match(sql,/settlement_id BIGINT UNSIGNED NOT NULL UNIQUE/);
 assert.match(setup,/102_airship_landing_facilities\.sql/);
 assert.match(logistics,/air_dock_requires_order_settlement/);
 assert.match(logistics,/air_dock_materials_insufficient/);
 assert.match(logistics,/air_dock_supply_must_be_local/);
 assert.match(logistics,/await ledger\(db,facility.id,dock.material_item_id,-Number\(dock.material_quantity\)/);
});

test('operational docks are checked before an airship freight leg departs',()=>{
 assert.match(logistics,/async function operationalAirDocks/);
 assert.match(logistics,/transport.mode==='air'&&!await operationalAirDocks/);
 assert.match(logistics,/airship_landing_facilities_required/);
 assert.match(logistics,/const hasLanding=/);
});

test('airship docks have command UI for construction and repair',()=>{
 assert.match(workspace,/LogisticsAirDocks/);
 assert.match(workspace,/Airship docks/);
 assert.match(panel,/Plan airship landing facility/);
 assert.match(panel,/Commission site/);
 assert.match(panel,/Repair dock/);
 assert.match(panel,/Reopen site/);
 assert.match(panel,/Manage/);
 assert.match(panel,/Mark damaged/);
 assert.match(panel,/Close site/);
});
