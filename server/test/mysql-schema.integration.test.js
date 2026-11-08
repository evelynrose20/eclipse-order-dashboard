import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';
import {generateToken,hashToken} from '../src/credentials.js';
import {characterRoute} from '../src/characters.js';
import {eventXpRoute} from '../src/event-xp.js';
import {accountRoute} from '../src/accounts.js';
import {authRoute} from '../src/auth.js';
import {factionRoute} from '../src/factions.js';
import {worldAdministrationRoute} from '../src/world-administration.js';
import {craftingRoute} from '../src/crafting.js';
import {commerceRoute} from '../src/commerce.js';
import {frontsRoute,runFrontDailyExpenses} from '../src/fronts.js';
import {constructionRoute} from '../src/construction.js';
import {runDailyPayroll,treasuryRoute} from '../src/treasury.js';

test('MySQL 8 schemas install together and retain existing Domina on re-run', {skip:process.env.ECLIPSE_CI_MYSQL!=='1'}, async()=>{
 const admin=createPool({
  host:'127.0.0.1',port:3306,user:'root',password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,
  database:'eclipse_order',multipleStatements:true,connectionLimit:1
 });
 try{
  for(const filename of ['001_core.sql','002_sessions.sql','005_features.sql','007_syndicate_ranks.sql','008_event_xp.sql','009_free_map_and_statblocks.sql','010_homebrew_classes.sql','011_event_story.sql','012_encounter_archives.sql','013_npc_allies.sql','014_discord_oauth.sql','015_discord_membership.sql','016_order_hierarchy.sql','017_factions.sql','018_faction_reputation.sql','019_faction_settlements.sql','020_fc_crafting_garden.sql','021_workshop_expansion.sql','022_expedition_encounters.sql','023_expedition_zones.sql','024_hellshade_bloom.sql','025_recipe_categories.sql','026_trade_and_equipment.sql','027_order_treasury_payroll.sql','028_order_fronts.sql','029_front_auto_expenses.sql','030_front_material_supplies.sql','031_character_reserved_goods.sql','032_construction_projects.sql','033_optional_senate.sql','034_live_governance.sql','035_garden_growth_clock.sql','036_senate_governing_chamber.sql','037_order_lore_archive.sql','038_garlean_origin_and_faq.sql','039_garlean_history_revision.sql','040_senate_politics.sql','041_world_administration_foundation.sql','042_world_routes_garlean_weather.sql','043_world_mountain_ranges_order_faction.sql','044_world_site_conditions.sql','045_world_transport_graph.sql','046_world_zones.sql','047_rail_infrastructure.sql','048_rail_interzone_links.sql','035_garden_growth_clock.sql']){
   // Reproduce a MariaDB installation where an older table already owns the generic
   // fk_wallet_character name. The treasury migration must still succeed.
   if(filename==='027_order_treasury_payroll.sql'){
    await admin.query("CREATE TABLE IF NOT EXISTS ci_existing_fk_name (character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL, CONSTRAINT fk_wallet_character FOREIGN KEY(character_id) REFERENCES characters(id)) ENGINE=InnoDB");
   }
   const sql=await readFile(new URL('../sql/'+filename,import.meta.url),'utf8');
   await admin.query(sql);
  }
  const [faqSeed]=await admin.query('SELECT id,question FROM order_public_faq ORDER BY sort_order,id');
  assert.equal(faqSeed.length,7,'initial public FAQ is imported');
  const [[garleanChapter]]=await admin.query("SELECT summary FROM order_lore_entries WHERE id='yanxia-order'");
  assert.match(garleanChapter.summary,/Garlean/);
  await admin.query("UPDATE order_public_faq SET answer='Custom written reply' WHERE id=?",[faqSeed[0].id]);
  await admin.query(await readFile(new URL('../sql/038_garlean_origin_and_faq.sql',import.meta.url),'utf8'));
  const [[savedFaq]]=await admin.query('SELECT answer FROM order_public_faq WHERE id=?',[faqSeed[0].id]);
  assert.equal(savedFaq.answer,'Custom written reply','setup does not erase FAQ edits');
  const [[stillGarlean]]=await admin.query("SELECT summary FROM order_lore_entries WHERE id='yanxia-order'");
  assert.equal(stillGarlean.summary,garleanChapter.summary,'repeat setup retains the revised origin');
  const [[garleanOrigins]]=await admin.query("SELECT title,era,body FROM order_lore_entries WHERE id='origins-thirteenth'");
  assert.equal(garleanOrigins.title,'Origins in Garlemald');
  assert.equal(garleanOrigins.era,'garlemald');
  assert.doesNotMatch(garleanOrigins.body,/Thirteenth|voidsent|voidrift/i);
  const [[calamity]]=await admin.query("SELECT title,body FROM order_lore_entries WHERE id='carteneau-crossing'");
  assert.match(calamity.body,/born in Garlemald/);
  assert.match(calamity.body,/Battle of Carteneau/);
  assert.match(calamity.body,/Dalamud/);
  await admin.query("UPDATE order_lore_entries SET title='Our own Garlean history',updated_by=NULL WHERE id='origins-thirteenth'");
  await admin.query(await readFile(new URL('../sql/039_garlean_history_revision.sql',import.meta.url),'utf8'));
  const [[customTitle]]=await admin.query("SELECT title FROM order_lore_entries WHERE id='origins-thirteenth'");
  assert.equal(customTitle.title,'Our own Garlean history','the canon migration does not erase custom titles');
  const [chronicles]=await admin.query('SELECT id,published FROM order_lore_entries ORDER BY id');
  assert.ok(chronicles.some(x=>x.id==='new-cassia'&&Number(x.published)===1));
  assert.ok(chronicles.some(x=>x.id==='early-journeys'&&Number(x.published)===0));
  await admin.query(await readFile(new URL('../sql/037_order_lore_archive.sql',import.meta.url),'utf8'));
  const [loreAgain]=await admin.query('SELECT id FROM order_lore_entries');
  assert.equal(loreAgain.length,chronicles.length,'repeat installation retains lore');
  const [worldTables]=await admin.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('world_regions','world_settlements','world_administration_audit')");
  assert.equal(worldTables.length,3,'world administration tables install with the rest of the API');
  const [[regionsBefore]]=await admin.query("SELECT COUNT(*) AS n FROM world_regions");
  assert.equal(Number(regionsBefore.n),0,'world administration starts empty and does not invent canon');
  await admin.query(await readFile(new URL('../sql/041_world_administration_foundation.sql',import.meta.url),'utf8'));
  const [[regionsAfter]]=await admin.query("SELECT COUNT(*) AS n FROM world_regions");
  assert.equal(Number(regionsAfter.n),0,'repeat setup does not create synthetic regions');
  const [politicalTables]=await admin.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('order_senate_parties','order_senate_party_members','order_senate_elections','order_senate_candidates','order_senate_election_ballots','order_senate_election_results','order_senate_election_rejections','order_senate_coalitions','order_senate_coalition_parties')");
  assert.equal(politicalTables.length,9,'Senate political tables are installed');
  const [partyColumn]=await admin.query("SHOW COLUMNS FROM order_senate_seats LIKE 'party_id'");
  assert.equal(partyColumn.length,1,'Senate seats preserve political affiliation');
  const [[partyCount]]=await admin.query('SELECT COUNT(*) AS n FROM order_senate_parties');
  assert.equal(Number(partyCount.n),0,'No sample parties are installed in the production database');
  await admin.query(await readFile(new URL('../sql/040_senate_politics.sql',import.meta.url),'utf8'));
  const [partyColumnAgain]=await admin.query("SHOW COLUMNS FROM order_senate_seats LIKE 'party_id'");
  assert.equal(partyColumnAgain.length,1,'Repeating setup does not duplicate the party column');
  const [senateSeats]=await admin.query('SELECT seat_number FROM order_senate_seats ORDER BY seat_number');
  const [senateHeads]=await admin.query('SELECT head_number FROM order_senate_heads ORDER BY head_number');
  assert.equal(senateSeats.length,15,'Senate has exactly fifteen senator positions');
  assert.deepEqual(senateHeads.map(r=>Number(r.head_number)),[2,3],'two appointed heads join the Domina');
  const [[senateSetting]]=await admin.query('SELECT enabled FROM order_senate_settings WHERE id=1');
  assert.equal(Number(senateSetting.enabled),0,'Senate remains disabled by default');
  await admin.query(await readFile(new URL('../sql/036_senate_governing_chamber.sql',import.meta.url),'utf8'));
  const [stableSeats]=await admin.query('SELECT seat_number FROM order_senate_seats');
  assert.equal(stableSeats.length,15,'repeated setup preserves the fifteen seats');
  await admin.query("ALTER TABLE accounts ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'");
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await admin.execute("INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,approval_status) VALUES(?,?,?,?,?,?,?)",
   [id,'admin@example.com','not-a-real-hash','Domina','domina','veteran','approved']);
  for(const filename of ['002_sessions.sql','005_features.sql','007_syndicate_ranks.sql','016_order_hierarchy.sql']){
   const sql=await readFile(new URL('../sql/'+filename,import.meta.url),'utf8');
   await admin.query(sql);
  }
  await admin.query(await readFile(new URL('../sql/014_discord_oauth.sql',import.meta.url),'utf8')); // repeatable
  await admin.query(await readFile(new URL('../sql/015_discord_membership.sql',import.meta.url),'utf8')); // repeatable
  const [columns]=await admin.query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('pos_x','pos_y','waymarks','monster_template_id','actions','notes')");
  assert.ok(columns.some(c=>c.TABLE_NAME==='order_encounters'&&c.COLUMN_NAME==='waymarks'));
  const [storyCols]=await admin.query("SHOW COLUMNS FROM order_encounters LIKE 'event_story'");
  assert.equal(storyCols.length,1);
  const [archiveCols]=await admin.query("SHOW COLUMNS FROM order_encounters LIKE 'archived_at'");
  assert.equal(archiveCols.length,1);
  const [authColumns]=await admin.query("SHOW COLUMNS FROM account_sessions LIKE 'auth_method'");
  assert.equal(authColumns.length,1);
  const [[combatantType]]=await admin.query("SHOW COLUMNS FROM order_combatants LIKE 'kind'");
  assert.match(combatantType.Type,/ally/);
  await admin.query(await readFile(new URL('../sql/013_npc_allies.sql',import.meta.url),'utf8')); // migration is repeatable
  await admin.query(await readFile(new URL('../sql/012_encounter_archives.sql',import.meta.url),'utf8'));
  const storyMigration=await readFile(new URL('../sql/011_event_story.sql',import.meta.url),'utf8');
  await admin.query(storyMigration); // rerunning is safe

  assert.ok(columns.some(c=>c.TABLE_NAME==='order_combatants'&&c.COLUMN_NAME==='pos_x'));
  const [reputation]=await admin.query('SELECT faction_id,order_view,faction_view FROM order_faction_reputation');
  assert.equal(reputation.length,5);
  assert.equal(reputation.find(r=>r.faction_id==='house-kurogane')?.order_view,45);
  assert.equal(reputation.find(r=>r.faction_id==='iron-remnant')?.faction_view,-95);
  const [[scope]]=await admin.query("SELECT faction_scope FROM order_factions WHERE id='ashen-veil'");
  assert.equal(scope.faction_scope,'order_story');
  const [[settlementColumn]]=await admin.query("SHOW COLUMNS FROM order_factions LIKE 'faction_scope'");
  assert.match(settlementColumn.Type,/settlement/);
  await admin.execute("INSERT INTO order_factions(id,name,leader,relationship,description,notes,faction_scope) VALUES(?,?,?,?,?,?,?)",
   ['test-hamlet','Test Hamlet','Village Council','neutral','An independent settlement.','','settlement']);
  const [[testHamlet]]=await admin.execute("SELECT faction_scope FROM order_factions WHERE id='test-hamlet'");
  assert.equal(testHamlet.faction_scope,'settlement');

  const [seedFactions]=await admin.query("SELECT id,leader,relationship,image_reference_url FROM order_factions WHERE faction_scope='order_story' ORDER BY sort_order");
  assert.equal(seedFactions.length,6,'five initial factions plus the Eclipse Order authority');
  assert.equal(seedFactions.find(f=>f.id==='house-kurogane')?.leader,'Lady Reika Kurogane');
  assert.equal(seedFactions.find(f=>f.id==='ashen-veil')?.relationship,'watchful_rival');
  assert.match(seedFactions.find(f=>f.id==='iron-remnant')?.image_reference_url||'',/^https:\/\//);
  await admin.query(await readFile(new URL('../sql/017_factions.sql',import.meta.url),'utf8'));
  const [[seedCount]]=await admin.query('SELECT COUNT(*) AS total FROM order_factions');
  assert.equal(Number(seedCount.total),7,'re-running migration preserves the original factions, the Order and the new settlement');
  const [fcMaterials]=await admin.query('SELECT id,name FROM fc_materials');
  assert.ok(fcMaterials.some(m=>m.id==='iron-ore'));
  assert.ok(fcMaterials.some(m=>m.id==='duskbloom'));
  await admin.query(await readFile(new URL('../sql/035_garden_growth_clock.sql',import.meta.url),'utf8')); // repeatable
  const [growthClock]=await admin.query("SHOW COLUMNS FROM fc_garden_plots LIKE 'last_growth_at'");
  assert.equal(growthClock.length,1,'growth clock exists after setup and repeat');
  const [fcPlots]=await admin.query('SELECT id,crop_material FROM fc_garden_plots');
  assert.equal(fcPlots.length,2);
  await admin.query(await readFile(new URL('../sql/020_fc_crafting_garden.sql',import.meta.url),'utf8'));
  const [[expeditionTable]]=await admin.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_gathering_runs'");
  assert.equal(Number(expeditionTable.n),1);
  const [zones]=await admin.query('SELECT id,minimum_level FROM fc_expedition_zones');
  assert.equal(zones.length,3);
  const [[plotCount]]=await admin.query('SELECT COUNT(*) AS n FROM fc_garden_plots');
  assert.equal(Number(plotCount.n),2,'setup should not duplicate FC garden plots');
  const [tables]=await admin.query('SHOW TABLES');
  const names=new Set(tables.map(r=>Object.values(r)[0]));
  for(const name of ['accounts','characters','character_status_requests','account_sessions',
    'order_profile_preferences','order_member_rp_profiles','order_encounters','order_combatants',
    'order_monster_templates','order_encounter_rolls','order_roll_requests','order_event_signups',
    'order_encounter_pauses','order_settings','order_event_xp_awards','order_homebrew_classes','account_discord_links','discord_oauth_states','discord_oauth_tickets'])assert.ok(names.has(name),'missing '+name);
  const [[row]]=await admin.execute('SELECT account_role FROM accounts WHERE id=?',[id]);
  assert.equal(row.account_role,'domina');
  const [[rank]]=await admin.execute('SELECT syndicate_rank FROM accounts WHERE id=?',[id]);
  assert.equal(rank.syndicate_rank,'domina');
  const [[canonicalDomina]]=await admin.execute("SELECT rank_code FROM account_order_ranks WHERE account_id=? AND track='leadership'",[id]);
  assert.equal(canonicalDomina.rank_code,'domina');
  const [rankCatalog]=await admin.query('SELECT code,track FROM order_rank_catalog');
  assert.ok(rankCatalog.some(x=>x.track==='leadership'&&x.code==='grand_viper'));
  assert.ok(rankCatalog.some(x=>x.track==='snakes'&&x.code==='high_serpent'));
  assert.ok(rankCatalog.some(x=>x.track==='servitude'&&x.code==='eclipsed_consort'));

  // Exercise character creation and syndicate ranks against disposable MySQL.
  const token=generateToken();
  await admin.execute('INSERT INTO account_sessions(account_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))',[id,hashToken(token)]);
  const request=(method,body)=>({method,headers:{authorization:'Bearer '+token},[Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}});
  // Validate editable world records against disposable MySQL, not just mocks.
  const worldRegion={name:'CI Highlands',description:'Test region',climate:'Garlean',weather:'snow',temperature_c:-12,weather_mode:'garlean_seasonal',simulation_mode:'off',map_background_url:''};
  const newRegion=await worldAdministrationRoute(admin,request('POST',worldRegion),'/world-admin/regions');
  assert.equal(newRegion.status,200,JSON.stringify(newRegion.body));
  const wrid=Number(newRegion.body.id);
  const updateRegion=await worldAdministrationRoute(admin,request('PUT',{...worldRegion,weather_mode:'manual'}),'/world-admin/regions/'+wrid);
  assert.equal(updateRegion.status,200,JSON.stringify(updateRegion.body));
  const worldPlace={region_id:wrid,name:'CI Mine',description:'Test location',directory_faction_id:null,governing_faction_id:null,controlling_faction_id:null,supporting_faction_id:null,map_x:25,map_y:50,map_icon:'mine',strategic_state:'peaceful',population:150,workforce:65,food_days:24,food_variety:60,heating_coverage:60,insulation:75,housing:65,medical_access:80,food_access:80,security_score:70,civil_stability:80,unrest:5,weather_exposure:70,simulation_enabled:false};
  const newMine=await worldAdministrationRoute(admin,request('POST',worldPlace),'/world-admin/settlements');
  assert.equal(newMine.status,200,JSON.stringify(newMine.body));
  const mineId=Number(newMine.body.id);
  const newPort=await worldAdministrationRoute(admin,request('POST',{...worldPlace,name:'CI Port',map_x:75,map_y:65,map_icon:'port'}),'/world-admin/settlements');
  assert.equal(newPort.status,200,JSON.stringify(newPort.body));
  const portId=Number(newPort.body.id);
  const moved=await worldAdministrationRoute(admin,request('POST',{map_x:44,map_y:52,map_icon:'refinery'}),'/world-admin/settlements/'+mineId+'/map');
  assert.equal(moved.status,200,JSON.stringify(moved.body));
  const [[afterMap]]=await admin.execute('SELECT map_x,map_icon,population,food_days FROM world_settlements WHERE id=?',[mineId]);
  assert.equal(Number(afterMap.map_x),44);
  assert.equal(afterMap.map_icon,'refinery');
  assert.equal(Number(afterMap.population),150,'map edit must not replace civilian state');
  assert.equal(Number(afterMap.food_days),24);
  const updatedWorldPlace=await worldAdministrationRoute(admin,request('PUT',{...worldPlace,map_icon:'factory'}),'/world-admin/settlements/'+mineId);
  assert.equal(updatedWorldPlace.status,200,JSON.stringify(updatedWorldPlace.body));
  const road=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,from_settlement_id:mineId,to_settlement_id:portId,route_type:'road',route_name:'CI road',waypoints:[{x:55,y:40}]}),'/world-admin/routes');
  assert.equal(road.status,200,JSON.stringify(road.body));
  const roadId=Number(road.body.id);
  const roadEdit=await worldAdministrationRoute(admin,request('PUT',{region_id:wrid,from_settlement_id:mineId,to_settlement_id:portId,route_type:'trail',route_name:'CI trail',waypoints:[{x:60,y:42}]}),'/world-admin/routes/'+roadId);
  assert.equal(roadEdit.status,200,JSON.stringify(roadEdit.body));
  const [[savedRoad]]=await admin.execute('SELECT route_type FROM world_map_routes WHERE id=?',[roadId]);
  assert.equal(savedRoad.route_type,'trail');
  const roadDelete=await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/routes/'+roadId);
  assert.equal(roadDelete.status,200,JSON.stringify(roadDelete.body));
   const nodeA=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,settlement_id:mineId}),'/world-admin/network/nodes');
 const nodeB=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,settlement_id:portId}),'/world-admin/network/nodes');
 assert.equal(nodeA.status,200,JSON.stringify(nodeA.body));assert.equal(nodeB.status,200,JSON.stringify(nodeB.body));
 const edge=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,from_node_id:Number(nodeA.body.id),to_node_id:Number(nodeB.body.id),route_type:'rail',route_name:'Mainline',waypoints:[{x:55,y:45}]}),'/world-admin/network/segments');
 assert.equal(edge.status,200,JSON.stringify(edge.body));
 const branchAt=await worldAdministrationRoute(admin,request('POST',{x:55,y:45}),'/world-admin/network/segments/'+edge.body.id+'/split');
 assert.equal(branchAt.status,200,JSON.stringify(branchAt.body));
 const junctionId=Number(branchAt.body.id);
 const [[j]]=await admin.execute('SELECT node_kind FROM world_route_nodes WHERE id=?',[junctionId]);assert.equal(j.node_kind,'rail_switch');
 const branchNode=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,x:65,y:30,node_kind:'junction',name:'Branch'}),'/world-admin/network/nodes');
 assert.equal(branchNode.status,200,JSON.stringify(branchNode.body));
 const branch=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,from_node_id:junctionId,to_node_id:Number(branchNode.body.id),route_type:'road',route_name:'Spur',waypoints:[]}),'/world-admin/network/segments');
 assert.equal(branch.status,200,JSON.stringify(branch.body));
 const cannotRemove=await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/network/nodes/'+junctionId);assert.equal(cannotRemove.status,409);
 const movedJunction=await worldAdministrationRoute(admin,request('PUT',{x:56,y:46,node_kind:'rail_switch',name:'Main switch'}),'/world-admin/network/nodes/'+junctionId);assert.equal(movedJunction.status,200);
 const [joined]=await admin.execute('SELECT id FROM world_route_segments WHERE from_node_id=? OR to_node_id=?',[junctionId,junctionId]);assert.equal(joined.length,3);
  const noConsent=await worldAdministrationRoute(admin,request('POST',{delete_connected_segments:false}),'/world-admin/network/nodes/'+junctionId+'/remove');
  assert.equal(noConsent.status,400,'explicit confirmation is needed to delete attached route segments');
  const deleteConnected=await worldAdministrationRoute(admin,request('POST',{delete_connected_segments:true}),'/world-admin/network/nodes/'+junctionId+'/remove');
  assert.equal(deleteConnected.status,200,JSON.stringify(deleteConnected.body));
  assert.equal(deleteConnected.body.deleted_segments,3);
  const [removedNodes]=await admin.execute('SELECT id FROM world_route_nodes WHERE id=?',[junctionId]);
  assert.equal(removedNodes.length,0,'junction is deleted');
  const [otherNodes]=await admin.execute('SELECT id FROM world_route_nodes WHERE id=?',[branchNode.body.id]);
  assert.equal(otherNodes.length,1,'unrelated nodes are preserved');
 const oldRoute=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,from_settlement_id:mineId,to_settlement_id:portId,route_type:'trail',route_name:'Old trail',waypoints:[{x:40,y:65}]}),'/world-admin/routes');assert.equal(oldRoute.status,200);
 const importedRoute=await worldAdministrationRoute(admin,request('POST',{region_id:wrid}),'/world-admin/network/import');assert.equal(importedRoute.status,200,JSON.stringify(importedRoute.body));assert.equal(importedRoute.body.imported,1);
 const [imported]=await admin.execute("SELECT route_name,waypoints FROM world_route_segments WHERE route_name='Old trail'");assert.equal(imported.length,1);
 const [legacyLeft]=await admin.execute('SELECT id FROM world_map_routes WHERE region_id=?',[wrid]);assert.equal(legacyLeft.length,0);

  // Split just one older smooth road into a durable shared junction.
  const oldSmooth=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,from_settlement_id:mineId,to_settlement_id:portId,route_type:'road',route_name:'Old smooth road',waypoints:[{x:60,y:40}]}),'/world-admin/routes');
  assert.equal(oldSmooth.status,200,JSON.stringify(oldSmooth.body));
  const untouched=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,from_settlement_id:mineId,to_settlement_id:portId,route_type:'trail',route_name:'Untouched trail',waypoints:[]}),'/world-admin/routes');
  assert.equal(untouched.status,200,JSON.stringify(untouched.body));
  const smoothSplit=await worldAdministrationRoute(admin,request('POST',{x:60,y:40}),'/world-admin/network/legacy/'+oldSmooth.body.id+'/branch');
  assert.equal(smoothSplit.status,200,JSON.stringify(smoothSplit.body));
  const [smoothSegments]=await admin.execute("SELECT route_type FROM world_route_segments WHERE route_name='Old smooth road'");
  assert.equal(smoothSegments.length,2);
  assert.ok(smoothSegments.every(r=>r.route_type==='road'));
  const [untouchedRows]=await admin.execute('SELECT id FROM world_map_routes WHERE id=?',[untouched.body.id]);
  assert.equal(untouchedRows.length,1,'unrelated existing roads are untouched');
  const joinedBranch=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,from_node_id:Number(smoothSplit.body.id),to_node_id:Number(branchNode.body.id),route_type:'road',route_name:'Connected branch',waypoints:[]}),'/world-admin/network/segments');
  assert.equal(joinedBranch.status,200,JSON.stringify(joinedBranch.body));
  const [joinedRoads]=await admin.execute('SELECT id FROM world_route_segments WHERE from_node_id=? OR to_node_id=?',[smoothSplit.body.id,smoothSplit.body.id]);
  assert.equal(joinedRoads.length,3,'the junction joins both road halves and the new branch');


  const [[overviewZone]]=await admin.execute("SELECT id,region_id,map_background_url FROM world_zones WHERE region_id=? AND slug='overview'",[wrid]);
  assert.ok(overviewZone?.id,'new region receives an overview map');
  const [[mineOverview]]=await admin.execute('SELECT zone_id FROM world_settlements WHERE id=?',[mineId]);
  assert.equal(Number(mineOverview.zone_id),Number(overviewZone.id),'existing-style settlement request defaults to overview zone');
  const zonePayload={region_id:wrid,name:'Northern Pass',description:'Mountain valley and frontier settlements',map_background_url:'https://example.com/northern-pass-map.webp',strategic_state:'secure',governing_faction_id:'eclipse-order',controlling_faction_id:'eclipse-order',supporting_faction_id:null};
  const createdZone=await worldAdministrationRoute(admin,request('POST',zonePayload),'/world-admin/zones');
  assert.equal(createdZone.status,200,JSON.stringify(createdZone.body));
  const newZoneId=Number(createdZone.body.id);
  const zoneSettlement=await worldAdministrationRoute(admin,request('POST',{...worldPlace,zone_id:newZoneId,name:'North Watch'}),'/world-admin/settlements');
  assert.equal(zoneSettlement.status,200,JSON.stringify(zoneSettlement.body));
  const outOfZoneNode=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,settlement_id:mineId}),'/world-admin/network/nodes');
  assert.equal(outOfZoneNode.status,400,'cannot attach a settlement from another zone');
  const watchNode=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,settlement_id:zoneSettlement.body.id}),'/world-admin/network/nodes');
  assert.equal(watchNode.status,200,JSON.stringify(watchNode.body));
  const crossZoneRoad=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,from_node_id:nodeA.body.id,to_node_id:watchNode.body.id,route_type:'road',route_name:'Not permitted',waypoints:[]}),'/world-admin/network/segments');
  assert.equal(crossZoneRoad.status,400,'connections cannot cross between independent zone maps');
  const zoneJunction=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,x:65,y:35,node_kind:'junction',name:'Northern junction'}),'/world-admin/network/nodes');
  assert.equal(zoneJunction.status,200,JSON.stringify(zoneJunction.body));
  const localZoneRoad=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,from_node_id:watchNode.body.id,to_node_id:zoneJunction.body.id,route_type:'road',route_name:'North road',waypoints:[]}),'/world-admin/network/segments');
  assert.equal(localZoneRoad.status,200,JSON.stringify(localZoneRoad.body));
  const zoneMountain=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,name:'Northern ridge',points:[{x:20,y:25},{x:60,y:40}]}),'/world-admin/mountains');
  assert.equal(zoneMountain.status,200,JSON.stringify(zoneMountain.body));
  const retrievedZones=await worldAdministrationRoute(admin,request('GET'),'/world-admin');
  assert.equal(retrievedZones.status,200);
  assert.ok(retrievedZones.body.zones.some(z=>Number(z.id)===newZoneId),'zones appear in world-admin response');
  assert.ok(retrievedZones.body.routes.every(r=>r.zone_id!=null));
  assert.ok(retrievedZones.body.network_nodes.every(n=>n.zone_id!=null));
  assert.ok(retrievedZones.body.mountains.some(m=>Number(m.zone_id)===newZoneId&&m.name==='Northern ridge'));
  const unconnectedSite=await worldAdministrationRoute(admin,request('POST',{...worldPlace,name:'South Camp'}),'/world-admin/settlements');
  assert.equal(unconnectedSite.status,200,JSON.stringify(unconnectedSite.body));
  const unconnectedNode=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,settlement_id:unconnectedSite.body.id}),'/world-admin/network/nodes');
  assert.equal(unconnectedNode.status,200,JSON.stringify(unconnectedNode.body));
  const moveUnconnectedSite=await worldAdministrationRoute(admin,request('PUT',{...worldPlace,zone_id:newZoneId,name:'South Camp'}),'/world-admin/settlements/'+unconnectedSite.body.id);
  assert.equal(moveUnconnectedSite.status,200,JSON.stringify(moveUnconnectedSite.body));
  const [[movedNode]]=await admin.execute('SELECT zone_id FROM world_route_nodes WHERE id=?',[unconnectedNode.body.id]);
  assert.equal(Number(movedNode.zone_id),newZoneId,'unconnected site node follows its settlement to the new zone');
  const tryMovingConnected=await worldAdministrationRoute(admin,request('PUT',{...worldPlace,zone_id:Number(overviewZone.id),name:'North Watch'}),'/world-admin/settlements/'+zoneSettlement.body.id);
  assert.equal(tryMovingConnected.status,409,'connected settlement cannot be moved across zone boundaries');
  const refusePopulatedZone=await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/zones/'+newZoneId);
  assert.equal(refusePopulatedZone.status,409,'populated zones are protected');
  const refuseOverviewDelete=await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/zones/'+overviewZone.id);
  assert.equal(refuseOverviewDelete.status,409,'overview cannot be deleted');
  const emptyZone=await worldAdministrationRoute(admin,request('POST',{...zonePayload,name:'Empty Coastal Zone',map_background_url:''}),'/world-admin/zones');
  assert.equal(emptyZone.status,200);
  const deleteEmptyZone=await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/zones/'+emptyZone.body.id);
  assert.equal(deleteEmptyZone.status,200,'empty zones can be deleted');

  // Railway station, platform, junction switch and crossing smoke/integration tests.
  const railDepot=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,x:76,y:50,node_kind:'junction',name:'Rail freight depot'}),'/world-admin/network/nodes');
  const railBranch=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:newZoneId,x:76,y:12,node_kind:'junction',name:'Secondary rail branch'}),'/world-admin/network/nodes');
  assert.equal(railDepot.status,200,JSON.stringify(railDepot.body));assert.equal(railBranch.status,200,JSON.stringify(railBranch.body));
  const railBase={region_id:wrid,zone_id:newZoneId,route_type:'rail',route_name:'North rail',waypoints:[]};
  const t1=await worldAdministrationRoute(admin,request('POST',{...railBase,from_node_id:watchNode.body.id,to_node_id:zoneJunction.body.id}),'/world-admin/network/segments');
  const t2=await worldAdministrationRoute(admin,request('POST',{...railBase,from_node_id:zoneJunction.body.id,to_node_id:railDepot.body.id}),'/world-admin/network/segments');
  const t3=await worldAdministrationRoute(admin,request('POST',{...railBase,from_node_id:zoneJunction.body.id,to_node_id:railBranch.body.id}),'/world-admin/network/segments');
  for(const track of [t1,t2,t3])assert.equal(track.status,200,JSON.stringify(track.body));
  const stationBase={region_id:wrid,zone_id:newZoneId,node_id:Number(watchNode.body.id),name:'Watch Depot',status:'operational',freight_enabled:true,passenger_enabled:false,freight_capacity:100,notes:''};
  const origin=await worldAdministrationRoute(admin,request('POST',stationBase),'/world-admin/rail/stations');
  const target=await worldAdministrationRoute(admin,request('POST',{...stationBase,node_id:Number(railDepot.body.id),name:'Freight Depot'}),'/world-admin/rail/stations');
  assert.equal(origin.status,200,JSON.stringify(origin.body));assert.equal(target.status,200,JSON.stringify(target.body));
  for(const stationId of [origin.body.id,target.body.id]){
    const platform=await worldAdministrationRoute(admin,request('POST',{station_id:Number(stationId),code:'F1',kind:'freight',track_length:25,capacity:30,status:'operational'}),'/world-admin/rail/platforms');
    assert.equal(platform.status,200,JSON.stringify(platform.body));
  }
  const preview=()=>worldAdministrationRoute(admin,request('POST',{origin_station_id:Number(origin.body.id),destination_station_id:Number(target.body.id)}),'/world-admin/rail/preview');
  assert.equal((await preview()).body.available,false,'three-track junction must configure an open switch');
  const turnout={node_id:Number(zoneJunction.body.id),entry_segment_id:Number(t1.body.id),exit_segment_id:Number(t2.body.id),status:'open',notes:''};
  const switchAdded=await worldAdministrationRoute(admin,request('POST',turnout),'/world-admin/rail/switches');
  assert.equal(switchAdded.status,200,JSON.stringify(switchAdded.body));
  assert.equal((await preview()).body.available,true);
  const closeSwitch=await worldAdministrationRoute(admin,request('PUT',{...turnout,status:'closed'}),'/world-admin/rail/switches/'+switchAdded.body.id);
  assert.equal(closeSwitch.status,200);assert.equal((await preview()).body.available,false);
  const railReopened=await worldAdministrationRoute(admin,request('PUT',turnout),'/world-admin/rail/switches/'+switchAdded.body.id);assert.equal(railReopened.status,200);
  const crossingBase={region_id:wrid,zone_id:newZoneId,rail_segment_id:Number(t1.body.id),road_segment_id:Number(localZoneRoad.body.id),name:'Watch crossing',map_x:25,map_y:50,control_type:'gated',status:'planned',notes:''};
  const crossing=await worldAdministrationRoute(admin,request('POST',crossingBase),'/world-admin/rail/crossings');
  assert.equal(crossing.status,200,JSON.stringify(crossing.body));
  assert.equal((await preview()).body.available,false,'unfinished crossing blocks rail freight');
  const openCrossing=await worldAdministrationRoute(admin,request('PUT',{...crossingBase,status:'operational'}),'/world-admin/rail/crossings/'+crossing.body.id);
  assert.equal(openCrossing.status,200);assert.equal((await preview()).body.available,true);
  const protectedTrack=await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/network/segments/'+t1.body.id);
  assert.equal(protectedTrack.status,409,'track referenced by switch/crossing cannot be silently deleted');
  assert.equal((await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/rail/stations/'+origin.body.id)).status,409,'platforms protect station from deletion');
  // Link freight-ready stations across two different zone maps, without joining map coordinates.
  const overviewRail=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:Number(overviewZone.id),from_node_id:Number(nodeA.body.id),to_node_id:Number(nodeB.body.id),route_type:'rail',route_name:'Overview transfer rail',waypoints:[]}),'/world-admin/network/segments');
  assert.equal(overviewRail.status,200,JSON.stringify(overviewRail.body));
  const remoteStation=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,zone_id:Number(overviewZone.id),node_id:Number(nodeA.body.id),name:'Regional Transfer',status:'operational',freight_enabled:true,passenger_enabled:false,freight_capacity:100,notes:''}),'/world-admin/rail/stations');
  assert.equal(remoteStation.status,200,JSON.stringify(remoteStation.body));
  const remotePlatform=await worldAdministrationRoute(admin,request('POST',{station_id:Number(remoteStation.body.id),code:'F1',kind:'freight',track_length:50,capacity:40,status:'operational'}),'/world-admin/rail/platforms');
  assert.equal(remotePlatform.status,200,JSON.stringify(remotePlatform.body));
  const interzonePayload={from_station_id:Number(origin.body.id),to_station_id:Number(remoteStation.body.id),name:'Northern transfer',status:'planned',bidirectional:true,freight_enabled:true,notes:'Regional interchange'};
  const interzone=await worldAdministrationRoute(admin,request('POST',interzonePayload),'/world-admin/rail/links');
  assert.equal(interzone.status,200,JSON.stringify(interzone.body));
  const previewInterzone=()=>worldAdministrationRoute(admin,request('POST',{origin_station_id:Number(origin.body.id),destination_station_id:Number(remoteStation.body.id)}),'/world-admin/rail/preview');
  assert.equal((await previewInterzone()).body.available,false,'planned interzone link cannot transport freight');
  const activatedInterzone=await worldAdministrationRoute(admin,request('PUT',{...interzonePayload,status:'operational'}),'/world-admin/rail/links/'+interzone.body.id);
  assert.equal(activatedInterzone.status,200,JSON.stringify(activatedInterzone.body));
  const allowedInterzone=await previewInterzone();
  assert.equal(allowedInterzone.status,200,JSON.stringify(allowedInterzone.body));
  assert.equal(allowedInterzone.body.available,true,'operational interzone link joins independent maps');
  assert.deepEqual(allowedInterzone.body.link_ids,[Number(interzone.body.id)]);
  const badLink=await worldAdministrationRoute(admin,request('POST',{...interzonePayload,to_station_id:Number(target.body.id)}),'/world-admin/rail/links');
  assert.equal(badLink.status,400,'interzone link cannot join two stations in one zone');
  const railState=await worldAdministrationRoute(admin,request('GET'),'/world-admin');
  assert.ok(railState.body.rail_stations.some(s=>Number(s.id)===Number(origin.body.id)&&s.freight_ready));
 const [[orderAuthority]]=await admin.execute("SELECT name FROM order_factions WHERE id='eclipse-order'");
  assert.equal(orderAuthority.name,'The Eclipse Order','Order authority must exist as a valid foreign key target');
  const orderHeld=await worldAdministrationRoute(admin,request('PUT',{...worldPlace,governing_faction_id:'eclipse-order',controlling_faction_id:'eclipse-order',supporting_faction_id:'eclipse-order'}),'/world-admin/settlements/'+mineId);
  assert.equal(orderHeld.status,200,JSON.stringify(orderHeld.body));
  const [[orderRefs]]=await admin.execute('SELECT governing_faction_id,controlling_faction_id,supporting_faction_id FROM world_settlements WHERE id=?',[mineId]);
  for(const value of Object.values(orderRefs))assert.equal(value,'eclipse-order');
  const stateResult=await worldAdministrationRoute(admin,request('POST',{strategic_state:'occupied'}),'/world-admin/settlements/'+mineId+'/state');
  assert.equal(stateResult.status,200,JSON.stringify(stateResult.body));
  const [[occupiedMine]]=await admin.execute('SELECT strategic_state,population FROM world_settlements WHERE id=?',[mineId]);
  assert.equal(occupiedMine.strategic_state,'occupied');
  assert.equal(Number(occupiedMine.population),150,'quick state change must preserve residents');
  for(const state of ['secure','abandoned','destroyed']){
   const change=await worldAdministrationRoute(admin,request('POST',{strategic_state:state}),'/world-admin/settlements/'+mineId+'/state');
   assert.equal(change.status,200,'state '+state+' should save: '+JSON.stringify(change.body));
   const [[saved]]=await admin.execute('SELECT strategic_state,controlling_faction_id,population FROM world_settlements WHERE id=?',[mineId]);
   assert.equal(saved.strategic_state,state);
   assert.equal(saved.controlling_faction_id,'eclipse-order','condition must never rewrite controller');
   assert.equal(Number(saved.population),150,'condition must preserve residents');
  }
  await admin.query(await readFile(new URL('../sql/044_world_site_conditions.sql',import.meta.url),'utf8'));
  const [[persistedStatus]]=await admin.execute('SELECT strategic_state FROM world_settlements WHERE id=?',[mineId]);
  assert.equal(persistedStatus.strategic_state,'destroyed','rerunning migration must not reset state');

  const mountainsResult=await worldAdministrationRoute(admin,request('POST',{region_id:wrid,name:'CI Mountain Ridge',points:[{x:10,y:20},{x:30,y:40},{x:70,y:20}]}),'/world-admin/mountains');
  assert.equal(mountainsResult.status,200,JSON.stringify(mountainsResult.body));
  const mountainId=Number(mountainsResult.body.id);
  const editMountain=await worldAdministrationRoute(admin,request('PUT',{region_id:wrid,name:'CI Snowcap Range',points:[{x:12,y:25},{x:40,y:33}]}),'/world-admin/mountains/'+mountainId);
  assert.equal(editMountain.status,200,JSON.stringify(editMountain.body));
  const [savedMountains]=await admin.execute('SELECT name,points FROM world_map_mountain_ranges WHERE id=?',[mountainId]);
  assert.equal(savedMountains[0].name,'CI Snowcap Range');
  const worldRead=await worldAdministrationRoute(admin,request('GET'),'/world-admin');
  assert.equal(worldRead.status,200);
  assert.ok(worldRead.body.factions.some(f=>f.id==='eclipse-order'));
  assert.ok(worldRead.body.mountains.some(m=>m.id===mountainId&&m.points.length===2));
  const deleteMountain=await worldAdministrationRoute(admin,request('DELETE'),'/world-admin/mountains/'+mountainId);
  assert.equal(deleteMountain.status,200,JSON.stringify(deleteMountain.body));

  const recruitId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await admin.execute("INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,approval_status) VALUES(?,?,?,?,?,?,?)",
   [recruitId,'recruit@example.com','not-a-real-hash','Recruit','member','initiate','approved']);
  const [[recruitBefore]]=await admin.execute('SELECT syndicate_rank FROM accounts WHERE id=?',[recruitId]);
  assert.equal(recruitBefore.syndicate_rank,'kumi_in');
  await admin.query(await readFile(new URL('../sql/016_order_hierarchy.sql',import.meta.url),'utf8')); // re-run backfills accounts created after initial migration
  const [[recruitStanding]]=await admin.execute("SELECT rank_code FROM account_order_ranks WHERE account_id=? AND track='membership'",[recruitId]);
  assert.equal(recruitStanding.rank_code,'freshscales');
  const changeRank=await accountRoute(admin,request('POST',{syndicate_rank:'oyabun'}),'/admin/accounts/'+recruitId+'/syndicate-rank');
  assert.equal(changeRank.status,200,JSON.stringify(changeRank.body));
  const [[recruitAfter]]=await admin.execute('SELECT syndicate_rank,account_role FROM accounts WHERE id=?',[recruitId]);
  assert.equal(recruitAfter.syndicate_rank,'oyabun');
  assert.equal(recruitAfter.account_role,'member','syndicate rank must not grant staff access');
  const assignNewRank=await accountRoute(admin,request('POST',{track:'snakes',code:'whisper'}),'/admin/accounts/'+recruitId+'/order-rank');
  assert.equal(assignNewRank.status,200,JSON.stringify(assignNewRank.body));
  const [[newRank]]=await admin.execute("SELECT rank_code FROM account_order_ranks WHERE account_id=? AND track='snakes'",[recruitId]);
  assert.equal(newRank.rank_code,'whisper');
  const invalidRank=await accountRoute(admin,request('POST',{track:'snakes',code:'high_fang'}),'/admin/accounts/'+recruitId+'/order-rank');
  assert.equal(invalidRank.status,400,'rank must belong to chosen branch');
  const invalidDomina=await accountRoute(admin,request('POST',{track:'leadership',code:'domina'}),'/admin/accounts/'+recruitId+'/order-rank');
  assert.equal(invalidDomina.status,403,'cannot assign Domina to a regular account');
  const diplomacy=await factionRoute(admin,request('POST',{target:'order_view',delta:10,event_title:'Trade mission',event_details:'The Order renewed market access.',account_id:null}),'/factions/house-kurogane/reputation');
  assert.equal(diplomacy.status,200,JSON.stringify(diplomacy.body));
  assert.equal(diplomacy.body.score,55);
  const personal=await factionRoute(admin,request('POST',{target:'player',delta:20,event_title:'Individual service',event_details:'The recruit aided House Kurogane.',account_id:recruitId}),'/factions/house-kurogane/reputation');
  assert.equal(personal.status,200,JSON.stringify(personal.body));
  const [[personalRank]]=await admin.execute('SELECT reputation FROM player_faction_reputation WHERE account_id=? AND faction_id=?',[recruitId,'house-kurogane']);
  assert.equal(personalRank.reputation,20);
  const [[orderRankAfter]]=await admin.execute("SELECT order_view,faction_view FROM order_faction_reputation WHERE faction_id='house-kurogane'");
  assert.equal(orderRankAfter.order_view,55);
  assert.equal(orderRankAfter.faction_view,40,'personal award must not change faction diplomacy');
  const memberList=await accountRoute(admin,request('GET'),'/admin/accounts');
  assert.equal(memberList.body.find(a=>a.user_id===recruitId)?.syndicate_rank,'oyabun');
  const myProfile=await authRoute(admin,request('GET'),'/auth/me');
  assert.equal(myProfile.body.user.syndicate_rank,'domina');
  const char=await characterRoute(admin,request('POST',{name:'CI Hero',class_id:'warrior',str:15,dex:14,con:13,int:12,wis:10,cha:8}),'/characters');
  assert.equal(char.status,201,JSON.stringify(char.body));
  const [[starterZone]]=await admin.execute("SELECT minimum_level FROM fc_expedition_zones WHERE id='ironridge-quarry'");
  assert.equal(starterZone.minimum_level,5);
  const tooLow=await craftingRoute(admin,request('POST',{zone_id:'ironridge-quarry',material_id:'iron-ore',character_id:char.body.id}),'/workshop/gather');
  assert.equal(tooLow.status,403,'level one character cannot enter a level five zone');
  await admin.execute("UPDATE characters SET sheet_json=JSON_SET(sheet_json,'$.level',5) WHERE id=?",[char.body.id]);
  const newZone=await craftingRoute(admin,request('POST',{id:'silver-marsh',name:'Silver Marsh',description:'A testing location.',minimum_level:8,danger:'high',enabled:true,sort_order:90,materials:[{material_id:'wild-herbs',minimum_level:9}]}),'/workshop/zones');
  assert.equal(newZone.status,200,JSON.stringify(newZone.body));
  const [storedZone]=await admin.execute("SELECT material_id,minimum_level FROM fc_expedition_zone_materials WHERE zone_id='silver-marsh'");
  assert.equal(storedZone[0].minimum_level,9);
  const zoneUpdated=await craftingRoute(admin,request('PUT',{name:'Silver Marsh',description:'Edited marsh.',minimum_level:8,danger:'moderate',enabled:true,sort_order:90,materials:[{material_id:'wild-herbs',minimum_level:10}]}),'/workshop/zones/silver-marsh');
  assert.equal(zoneUpdated.status,200,JSON.stringify(zoneUpdated.body));
  const [updatedZoneMaterials]=await admin.execute("SELECT minimum_level FROM fc_expedition_zone_materials WHERE zone_id='silver-marsh'");
  assert.equal(updatedZoneMaterials[0].minimum_level,10);
  const invalidLocation=await craftingRoute(admin,request('POST',{zone_id:'estate-woodlands',material_id:'iron-ore',character_id:char.body.id}),'/workshop/gather');
  assert.equal(invalidLocation.status,400,'ore cannot be mined in the woodland zone');
  const elevatedRecipe=await craftingRoute(admin,request('PUT',{minimum_level:10}),'/workshop/catalog/recipes/smelt-iron/level');
  assert.equal(elevatedRecipe.status,200);
  const prematureCraft=await craftingRoute(admin,request('POST',{recipe_id:'smelt-iron',quantity:1,character_id:char.body.id}),'/workshop/craft');
  assert.equal(prematureCraft.status,403,'crafting uses the character sheet level');
  await craftingRoute(admin,request('PUT',{minimum_level:1}),'/workshop/catalog/recipes/smelt-iron/level');
  const [encounterScenarios]=await admin.query('SELECT id,kind,enabled FROM fc_expedition_scenarios ORDER BY id');
  assert.ok(encounterScenarios.some(item=>item.kind==='wildlife'));
  assert.ok(encounterScenarios.some(item=>item.kind==='mature'));
  // Exercise the shared stock ledger without nondeterministic encounter interrupts.
  await admin.query('UPDATE fc_expedition_scenarios SET enabled=0');
  let gatheredTotal=0;
  for(let attempt=0;attempt<5;attempt++){
   const gathered=await craftingRoute(admin,request('POST',{zone_id:'ironridge-quarry',material_id:'iron-ore',character_id:char.body.id}),'/workshop/gather');
   assert.equal(gathered.status,200,JSON.stringify(gathered.body));
   assert.ok(gathered.body.quantity>=1&&gathered.body.quantity<=4);
   gatheredTotal+=gathered.body.quantity;
  }
  const exhausted=await craftingRoute(admin,request('POST',{zone_id:'ironridge-quarry',material_id:'iron-ore',character_id:char.body.id}),'/workshop/gather');
  assert.equal(exhausted.status,409,'daily expedition cap must be enforced');
  const crafted=await craftingRoute(admin,request('POST',{recipe_id:'smelt-iron',quantity:1,character_id:char.body.id}),'/workshop/craft');
  assert.equal(crafted.status,200,JSON.stringify(crafted.body));
  const [[ironStock]]=await admin.execute("SELECT quantity FROM fc_material_stock WHERE material_id='iron-ingot'");
  assert.equal(ironStock.quantity,1);
  const [[oreStock]]=await admin.execute("SELECT quantity FROM fc_material_stock WHERE material_id='iron-ore'");
  assert.equal(oreStock.quantity,gatheredTotal-3);
  const noStock=await craftingRoute(admin,request('POST',{recipe_id:'smelt-iron',quantity:100,character_id:char.body.id}),'/workshop/craft');
  assert.equal(noStock.status,409,'insufficient stock must roll back atomically');
  const noCharacterCare=await craftingRoute(admin,request('POST',{action:'water'}),'/workshop/garden/1/care');
  assert.equal(noCharacterCare.status,400,'garden requires a character sheet');
  const care=await craftingRoute(admin,request('POST',{character_id:char.body.id,action:'water'}),'/workshop/garden/1/care');
  assert.equal(care.status,200,JSON.stringify(care.body));
  const gardenState=await craftingRoute(admin,request('GET'),'/workshop');
  assert.equal(gardenState.status,200);
  assert.equal(gardenState.body.plots.find(p=>p.id===1).cared_today,true);
  assert.equal(Number(gardenState.body.plots.find(p=>p.id===1).helpers_today),1);
  const [[hellshade]]=await admin.query("SELECT category FROM fc_materials WHERE id='hellshade-bloom'");
  assert.equal(hellshade.category,'botanical');
  const [categoryRows]=await admin.query('SELECT id,name FROM fc_recipe_categories');
  assert.ok(categoryRows.some(c=>c.id==='refining'));
  const [[ironCategory]]=await admin.query("SELECT category_id FROM fc_recipes WHERE id='smelt-iron'");
  assert.equal(ironCategory.category_id,'refining');
  const [[tonicCategory]]=await admin.query("SELECT category_id FROM fc_recipes WHERE id='herbal-tonic'");
  assert.equal(tonicCategory.category_id,'tonics');
  const categoryCreated=await craftingRoute(admin,request('POST',{id:'furnishings',name:'Furnishings',description:'Estate furnishings',sort_order:50}),'/workshop/catalog/categories');
  assert.equal(categoryCreated.status,200,JSON.stringify(categoryCreated.body));
  const movedRecipe=await craftingRoute(admin,request('PUT',{category_id:'furnishings'}),'/workshop/catalog/recipes/smelt-iron/category');
  assert.equal(movedRecipe.status,200);
  await admin.query(await readFile(new URL('../sql/025_recipe_categories.sql',import.meta.url),'utf8'));
  const [[preservedCategory]]=await admin.query("SELECT category_id FROM fc_recipes WHERE id='smelt-iron'");
  assert.equal(preservedCategory.category_id,'furnishings','rerunning migration must not overwrite a chosen recipe category');
  const returnedRecipe=await craftingRoute(admin,request('PUT',{category_id:'refining'}),'/workshop/catalog/recipes/smelt-iron/category');
  assert.equal(returnedRecipe.status,200);
  const [[dustRecipe]]=await admin.query("SELECT minimum_level FROM fc_recipes WHERE id='demon-dust'");
  assert.equal(dustRecipe.minimum_level,12);
  const repeatCare=await craftingRoute(admin,request('POST',{character_id:char.body.id,action:'tend'}),'/workshop/garden/1/care');
  assert.equal(repeatCare.status,409,'a member may care once per plot each day');
  const [ledgerRows]=await admin.query('SELECT activity,delta FROM fc_material_ledger ORDER BY id');
  assert.equal(ledgerRows.filter(l=>l.activity==='gather').length,5);
  assert.equal(ledgerRows.filter(l=>l.activity==='craft_input').length,1);
  assert.equal(ledgerRows.filter(l=>l.activity==='craft_output').length,1);
  const newScenario=await craftingRoute(admin,request('POST',{id:'forest-wolf',name:'Forest Wolf',kind:'wildlife',description:'A wolf stands in the path.',outcome_text:'The wolf flees.',failure_text:'The wolf wins the fight.',retreat_text:'The adventurer retreats.',decline_text:'The wolf is avoided.',weight:10,enemy_health:7,enemy_defense:10}),'/workshop/encounters/scenarios');
  assert.equal(newScenario.status,200,JSON.stringify(newScenario.body));
  const [[addedScenario]]=await admin.query("SELECT name FROM fc_expedition_scenarios WHERE id='forest-wolf'");
  assert.equal(addedScenario.name,'Forest Wolf');
  const invalidScenario=await craftingRoute(admin,request('POST',{id:'bad',name:'Bad',kind:'wildlife',description:'Danger',outcome_text:'',failure_text:'Failure.',retreat_text:'Retreat.',decline_text:'Declined.',weight:0,enemy_health:7,enemy_defense:10}),'/workshop/encounters/scenarios');
  assert.equal(invalidScenario.status,400);

  const newMaterial=await craftingRoute(admin,request('POST',{id:'gloom-moss',name:'Gloom Moss',category:'botanical',description:'A fictional shade garden crop.'}),'/workshop/catalog/materials');
  assert.equal(newMaterial.status,200,JSON.stringify(newMaterial.body));
  const newRecipe=await craftingRoute(admin,request('POST',{id:'moss-balm',name:'Moss Balm',description:'Fantasy medicinal crafting.',output_material:'herbal-tonic',output_quantity:1,minimum_level:1,category_id:'tonics',inputs:[{material_id:'gloom-moss',quantity:2}]}),'/workshop/catalog/recipes');
  assert.equal(newRecipe.status,200,JSON.stringify(newRecipe.body));
  const [[recipeEntry]]=await admin.query("SELECT name FROM fc_recipes WHERE id='moss-balm'");
  assert.equal(recipeEntry.name,'Moss Balm');
  const fullGarden=await craftingRoute(admin,request('POST',{crop_material:'gloom-moss'}),'/workshop/catalog/plots');
  assert.equal(fullGarden.status,409,'garden cannot bypass capacity without upgrades');
  await admin.execute("UPDATE fc_material_stock SET quantity=5 WHERE material_id='iron-ingot'");
  const upgraded=await craftingRoute(admin,request('POST',{}),'/workshop/garden/upgrade');
  assert.equal(upgraded.status,200,JSON.stringify(upgraded.body));
  const planted=await craftingRoute(admin,request('POST',{crop_material:'gloom-moss'}),'/workshop/catalog/plots');
  assert.equal(planted.status,200,JSON.stringify(planted.body));
  const [[newPlot]]=await admin.query("SELECT crop_material FROM fc_garden_plots WHERE id=3");
  assert.equal(newPlot.crop_material,'gloom-moss');
  const encounterRun=await admin.execute('INSERT INTO fc_gathering_runs(account_id,character_id,material_id,quantity,expedition_day) VALUES(?,?,?,0,UTC_DATE())',[id,char.body.id,'wild-herbs']);
  const [encounterCreated]=await admin.execute('INSERT INTO fc_expedition_encounters(gathering_run_id,scenario_id,account_id,player_health,enemy_health) VALUES(?,?,?,?,?)',
   [encounterRun[0].insertId,'masked-stranger',id,12,1]);
  const matureId=encounterCreated.insertId;
  const ongoing=await craftingRoute(admin,request('GET'),'/workshop/encounters');
  assert.equal(ongoing.status,200);
  assert.equal(Number(ongoing.body.active.id),matureId);
  const declined=await craftingRoute(admin,request('POST',{action:'decline'}),'/workshop/encounters/'+matureId+'/action');
  assert.equal(declined.status,200,JSON.stringify(declined.body));
  assert.equal(declined.body.status,'declined');
  assert.ok(declined.body.quantity>=1,'declining optional mature encounters keeps the ordinary expedition materials');
  const duplicate=await craftingRoute(admin,request('POST',{action:'continue'}),'/workshop/encounters/'+matureId+'/action');
  assert.equal(duplicate.status,409,'resolved encounters never award a second time');
  const enemyRun=await admin.execute('INSERT INTO fc_gathering_runs(account_id,character_id,material_id,quantity,expedition_day) VALUES(?,?,?,0,UTC_DATE())',[id,char.body.id,'iron-ore']);
  const [enemyCreated]=await admin.execute('INSERT INTO fc_expedition_encounters(gathering_run_id,scenario_id,account_id,player_health,enemy_health) VALUES(?,?,?,?,?)',
   [enemyRun[0].insertId,'wild-boar',id,12,9]);
  const fled=await craftingRoute(admin,request('POST',{action:'retreat'}),'/workshop/encounters/'+enemyCreated.insertId+'/action');
  assert.equal(fled.status,200,JSON.stringify(fled.body));
  assert.equal(fled.body.status,'retreated');
  assert.equal(fled.body.quantity,0);
  const eventId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await admin.execute('INSERT INTO order_encounters(id,name,notes,themes,created_by,status,description) VALUES(?,?,?,?,?,?,?)',
   [eventId,'CI Adventure','',JSON.stringify([]),id,'completed','']);
  const partId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  await admin.execute('INSERT INTO order_combatants(id,encounter_id,name,kind,character_id,conditions) VALUES(?,?,?,?,?,?)',
   [partId,eventId,'CI Hero','player',char.body.id,JSON.stringify([])]);
  const reward=await eventXpRoute(admin,request('POST',{amount:300}),'/events/'+eventId+'/xp/'+char.body.id);
  assert.equal(reward.status,200,JSON.stringify(reward.body));
  assert.equal(reward.body.experience,300);
  assert.equal(reward.body.level,2);
  const repeated=await eventXpRoute(admin,request('POST',{amount:300}),'/events/'+eventId+'/xp/'+char.body.id);
  assert.equal(repeated.status,409,'a character cannot earn XP twice for the same event');
  const list=await eventXpRoute(admin,request('GET'),'/events/'+eventId+'/xp');
  assert.equal(list.body.awards.length,1);
  const [updated]=await admin.execute('SELECT sheet_json FROM characters WHERE id=?',[char.body.id]);
  const newSheet=typeof updated[0].sheet_json==='string'?JSON.parse(updated[0].sheet_json):updated[0].sheet_json;
  assert.equal(newSheet.experience,300);
  // End-to-end trading and gear: shared inputs -> character equipment -> equipped slot -> faction reputation.
  const initialCommerce=await commerceRoute(admin,request('GET'),'/commerce');
  assert.equal(initialCommerce.status,200);
  assert.ok(initialCommerce.body.templates.some(t=>t.id==='field-pick'));
  await admin.execute("INSERT INTO fc_material_stock(material_id,quantity) VALUES('iron-ingot',25) ON DUPLICATE KEY UPDATE quantity=25");
  const ownPick=await commerceRoute(admin,request('POST',{template_id:'field-pick',character_id:char.body.id}),'/commerce/craft');
  assert.equal(ownPick.status,200,JSON.stringify(ownPick.body));
  const pickId=ownPick.body.item_id;
  const pickInventory=await commerceRoute(admin,request('GET'),'/commerce/characters/'+char.body.id+'/equipment');
  assert.equal(pickInventory.status,200);
  assert.equal(pickInventory.body.items.some(item=>Number(item.id)===pickId),true);
  const equipped=await commerceRoute(admin,request('POST',{equipped:true}),'/commerce/characters/'+char.body.id+'/equipment/'+pickId+'/equip');
  assert.equal(equipped.status,200);
  const equipmentAfter=await commerceRoute(admin,request('GET'),'/commerce/characters/'+char.body.id+'/equipment');
  assert.equal(equipmentAfter.body.bonuses.tool,1);
  const contract=await commerceRoute(admin,request('POST',{faction_id:'test-hamlet',title:'Supply settlement metal',description:'Deliver metal to local makers.',item_kind:'material',item_id:'iron-ingot',required_quantity:4,rep_per_unit:2,sale_value_per_unit:10}),'/commerce/contracts');
  assert.equal(contract.status,200,JSON.stringify(contract.body));
  const firstDelivery=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:3}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(firstDelivery.status,200,JSON.stringify(firstDelivery.body));
  assert.equal(firstDelivery.body.reputation_change,6);
  const traderHistory=await commerceRoute(admin,request('GET'),'/commerce');
  const memberDelivery=traderHistory.body.deliveries.find(d=>Number(d.contract_id)===Number(contract.body.id));
  assert.equal(memberDelivery.is_mine,true,'own executed trades must be identifiable to the signed-in member');
  const overDelivery=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:2}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(overDelivery.status,409,'cannot exceed contract remaining amount');
  const completed=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:1}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(completed.status,200);
  assert.equal(completed.body.complete,true);
  const deliverTwice=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:1}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(deliverTwice.status,409,'completed contract must not double reward');
  const gearContract=await commerceRoute(admin,request('POST',{faction_id:'test-hamlet',title:'Settlement tools',description:'Deliver a crafted mining pick.',item_kind:'equipment',item_id:'field-pick',required_quantity:1,rep_per_unit:3,sale_value_per_unit:20}),'/commerce/contracts');
  assert.equal(gearContract.status,200);
  const cannotTradeEquipped=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:1,equipment_item_id:pickId}),'/commerce/contracts/'+gearContract.body.id+'/deliver');
  assert.equal(cannotTradeEquipped.status,409,'cannot trade currently equipped tool');
  const unequip=await commerceRoute(admin,request('POST',{equipped:false}),'/commerce/characters/'+char.body.id+'/equipment/'+pickId+'/equip');
  assert.equal(unequip.status,200);
  const handedOver=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:1,equipment_item_id:pickId}),'/commerce/contracts/'+gearContract.body.id+'/deliver');
  assert.equal(handedOver.status,200,JSON.stringify(handedOver.body));
  assert.equal(handedOver.body.reputation_change,3);
  const [[consumedItem]]=await admin.execute('SELECT status,equipped FROM character_equipment_items WHERE id=?',[pickId]);
  assert.equal(consumedItem.status,'traded');
  assert.equal(Number(consumedItem.equipped),0);
  const [[tradeReputation]]=await admin.execute("SELECT faction_view FROM order_faction_reputation WHERE faction_id='test-hamlet'");
  assert.equal(Number(tradeReputation.faction_view),11);
  const [tradeLog]=await admin.execute("SELECT applied_delta FROM faction_reputation_changes WHERE faction_id='test-hamlet' AND target='faction_view' ORDER BY id");
  assert.deepEqual(tradeLog.map(e=>Number(e.applied_delta)),[6,2,3]);
  // All character pay is funded by trade proceeds, never by a free daily mint.
  const [[treasuryBefore]]=await admin.execute('SELECT balance FROM order_treasury WHERE id=1');
  assert.equal(Number(treasuryBefore.balance),60,'4 ingots at 10 and 1 tool at 20 fund the Order');
  const [incomeEntries]=await admin.query('SELECT amount FROM order_treasury_ledger WHERE category="trade" ORDER BY id');
  assert.deepEqual(incomeEntries.map(e=>Number(e.amount)),[30,10,20]);
  const boundId='99999999-9999-4999-8999-999999999999';
  await admin.execute('INSERT INTO characters(id,character_name,player_account_id,collar_bound,bound_rank,sheet_json) VALUES(?,?,?,?,?,?)',
   [boundId,'CI Bound Worker',id,1,'rank_i',JSON.stringify({name:'CI Bound Worker',level:1})]);
  const payroll=await runDailyPayroll(admin,new Date('2026-11-06T15:15:00Z'));
  assert.equal(payroll.status,200,JSON.stringify(payroll.body));
  assert.equal(payroll.body.status,'paid');
  assert.equal(payroll.body.requested_total,6,'member earns five gil, bound character one');
  assert.equal(payroll.body.paid_total,6);
  const repeatPayroll=await runDailyPayroll(admin,new Date('2026-11-06T17:00:00Z'));
  assert.equal(repeatPayroll.body.status,'already_paid');
  const memberWallet=await treasuryRoute(admin,request('GET'),'/treasury/characters/'+char.body.id);
  assert.equal(memberWallet.body.balance,5);
  const slaveWallet=await treasuryRoute(admin,request('GET'),'/treasury/characters/'+boundId);
  assert.equal(slaveWallet.body.balance,1);
  const missingFunds=await treasuryRoute(admin,request('POST',{amount:1000}),'/treasury/missions/'+eventId+'/pay/'+char.body.id);
  assert.equal(missingFunds.status,409,'missions cannot overdraw');
  const missionPaid=await treasuryRoute(admin,request('POST',{amount:7}),'/treasury/missions/'+eventId+'/pay/'+char.body.id);
  assert.equal(missionPaid.status,200,JSON.stringify(missionPaid.body));
  const doubleMission=await treasuryRoute(admin,request('POST',{amount:7}),'/treasury/missions/'+eventId+'/pay/'+char.body.id);
  assert.equal(doubleMission.status,409,'same character cannot earn the same event reward twice');
  const [[memberPurse]]=await admin.execute('SELECT balance FROM character_wallets WHERE character_id=?',[char.body.id]);
  assert.equal(Number(memberPurse.balance),12);
  const [[cashAfter]]=await admin.execute('SELECT balance FROM order_treasury WHERE id=1');
  assert.equal(Number(cashAfter.balance),47,'trade revenue less real wages and mission spending');
  await admin.execute('UPDATE order_treasury SET balance=1 WHERE id=1');
  const lowCashPayroll=await runDailyPayroll(admin,new Date('2026-11-07T15:30:00Z'));
  assert.equal(lowCashPayroll.body.paid_total,1,'low cash proportionally lowers wages instead of printing money');
  const [[emptyCash]]=await admin.execute('SELECT balance FROM order_treasury WHERE id=1');
  assert.equal(Number(emptyCash.balance),0);
  const noBackPay=await runDailyPayroll(admin,new Date('2026-11-07T16:00:00Z'));
  assert.equal(noBackPay.body.status,'already_paid');
  const [payRecords]=await admin.query('SELECT cycle_date,character_id,paid_amount FROM order_daily_payroll ORDER BY cycle_date,character_id');
  assert.equal(payRecords.length,4,'exactly one record per character and reset');
  // Order fronts: both approvals gate operations, allocated FC stock stays real,
  // and successful foreign trades divide actual gil between the Order and the front.
  const openedFront=await frontsRoute(admin,request('POST',{
   name:'CI Golden Claw Merchant',category:'merchant',location:'Goblet P41 W5',description:'A licensed trade front.',
   ownership:'member',owner_character_id:char.body.id,license_terms:''}),'/fronts');
  assert.equal(openedFront.status,200,JSON.stringify(openedFront.body));
  const frontId=openedFront.body.id;
  const beforeApproval=await frontsRoute(admin,request('POST',{material_id:'iron-ingot',quantity:2,direction:'allocate',character_id:char.body.id}),'/fronts/'+frontId+'/stock');
  assert.equal(beforeApproval.status,403,'front cannot operate while its license is pending');
  const recruitToken=generateToken();
  await admin.execute('INSERT INTO account_sessions(account_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))',[recruitId,hashToken(recruitToken)]);
  const recruitRequest=(method,body)=>({method,headers:{authorization:'Bearer '+recruitToken},[Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}});
  const unauthorizedIc=await frontsRoute(admin,recruitRequest('POST',{stage:'ic',approved:true}),'/fronts/'+frontId+'/approve');
  assert.equal(unauthorizedIc.status,403,'ordinary members cannot approve a front');
  const appointedClaw=await accountRoute(admin,request('POST',{track:'golden_claws',code:'high_claw'}),'/admin/accounts/'+recruitId+'/order-rank');
  assert.equal(appointedClaw.status,200,JSON.stringify(appointedClaw.body));
  const ic=await frontsRoute(admin,recruitRequest('POST',{stage:'ic',approved:true}),'/fronts/'+frontId+'/approve');
  assert.equal(ic.body.status,'pending','Golden Claws IC approval alone cannot open a front');
  const deniedWebsite=await frontsRoute(admin,recruitRequest('POST',{stage:'website',approved:true}),'/fronts/'+frontId+'/approve');
  assert.equal(deniedWebsite.status,403,'Golden Claws officers cannot self-grant portal approval');
  const web=await frontsRoute(admin,request('POST',{stage:'website',approved:true}),'/fronts/'+frontId+'/approve');
  assert.equal(web.body.status,'active','two approvals activate the licensed business');
  const notLicensed=await frontsRoute(admin,request('POST',{offer_type:'service',name:'Masked Consultation',description:'Private occult consultation',posted_price:15,restricted:true}),'/fronts/'+frontId+'/offerings');
  assert.equal(notLicensed.status,403,'restricted services require explicit additional approval');
  const serviceRequest=await frontsRoute(admin,request('POST',{request_type:'restricted_service',requested_value:'Masked Consultation',justification:'Private consultations at the licensed front.'}),'/fronts/'+frontId+'/changes');
  assert.equal(serviceRequest.status,200,JSON.stringify(serviceRequest.body));
  const reviewService=await frontsRoute(admin,request('POST',{decision:'approved'}),'/fronts/'+frontId+'/changes/'+serviceRequest.body.id+'/review');
  assert.equal(reviewService.status,200);
  const serviceApproved=await frontsRoute(admin,request('POST',{offer_type:'service',name:'Masked Consultation',description:'Private occult consultation',posted_price:15,restricted:true}),'/fronts/'+frontId+'/offerings');
  assert.equal(serviceApproved.status,200,JSON.stringify(serviceApproved.body));
  const doubleApproval=await frontsRoute(admin,request('POST',{decision:'approved'}),'/fronts/'+frontId+'/changes/'+serviceRequest.body.id+'/review');
  assert.equal(doubleApproval.status,409);
  const newLocation=await frontsRoute(admin,request('POST',{request_type:'location',requested_value:'Goblet Plot 41 Ward 5',justification:'Moving to the approved Goblet estate.'}),'/fronts/'+frontId+'/changes');
  assert.equal(newLocation.status,200);
  const locationApproved=await frontsRoute(admin,request('POST',{decision:'approved'}),'/fronts/'+frontId+'/changes/'+newLocation.body.id+'/review');
  assert.equal(locationApproved.status,200);
  const [[movedFront]]=await admin.execute('SELECT location FROM order_fronts WHERE id=?',[frontId]);
  assert.equal(movedFront.location,'Goblet Plot 41 Ward 5');
  const storefront=await frontsRoute(admin,request('POST',{
   offer_type:'goods',material_id:'iron-ingot',name:'Ingot supply',description:'Official workshop stock',posted_price:18}),'/fronts/'+frontId+'/offerings');
  assert.equal(storefront.status,200,JSON.stringify(storefront.body));
  const assignment=await frontsRoute(admin,request('POST',{character_id:char.body.id,staff_role:'manager'}),'/fronts/'+frontId+'/staff');
  assert.equal(assignment.status,200);
  const allocate=await frontsRoute(admin,request('POST',{material_id:'iron-ingot',quantity:4,direction:'allocate',character_id:char.body.id}),'/fronts/'+frontId+'/stock');
  assert.equal(allocate.status,200,JSON.stringify(allocate.body));
  const frontStock=await frontsRoute(admin,request('GET'),'/fronts/'+frontId+'/stocks');
  assert.equal(Number(frontStock.body.stocks.find(s=>s.material_id==='iron-ingot').quantity),4);
  const newFrontOrder=await commerceRoute(admin,request('POST',{faction_id:'test-hamlet',title:'Golden Claw ingots',description:'Settlement buying ingots',item_kind:'material',item_id:'iron-ingot',required_quantity:3,rep_per_unit:1,sale_value_per_unit:20}),'/commerce/contracts');
  assert.equal(newFrontOrder.status,200,JSON.stringify(newFrontOrder.body));
  const badFrontShipment=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:4,front_id:frontId}),'/commerce/contracts/'+newFrontOrder.body.id+'/deliver');
  assert.equal(badFrontShipment.status,409,'cannot ship more than the contract requires');
  const frontShipment=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:2,front_id:frontId}),'/commerce/contracts/'+newFrontOrder.body.id+'/deliver');
  assert.equal(frontShipment.status,200,JSON.stringify(frontShipment.body));
  assert.equal(frontShipment.body.order_income,12,'Order receives its thirty percent share of forty gil');
  assert.equal(frontShipment.body.front_earnings,28,'front retains the remainder of trade revenue');
  const frontDetails=await frontsRoute(admin,request('GET'),'/fronts/'+frontId);
  assert.equal(Number(frontDetails.body.front.balance),28);
  assert.equal(Number(frontDetails.body.stocks.find(s=>s.material_id==='iron-ingot').quantity),2);
  const manualExpense=await frontsRoute(admin,request('POST',{amount:5,description:'Player paying rent'}),'/fronts/'+frontId+'/expenses');
  assert.equal(manualExpense.status,404,'manual player-dependent payments were removed');
  const setUpkeep=await frontsRoute(admin,request('POST',{daily_rent:3,daily_upkeep:1}),'/fronts/'+frontId+'/operating-costs');
  assert.equal(setUpkeep.status,200);
  const requireGoods=await frontsRoute(admin,request('POST',{material_id:'iron-ingot',daily_quantity:2}),'/fronts/'+frontId+'/supply-requirements');
  assert.equal(requireGoods.status,200,'command configures physical daily supplies');
  const expenses=await runFrontDailyExpenses(admin,new Date('2026-11-08T16:00:00Z'));
  assert.equal(expenses.processed,1);
  assert.equal(expenses.paid,4,'only rent and upkeep cost gil');
  assert.equal(expenses.unitsConsumed,2,'supplies consume real allocated stock');
  assert.equal(expenses.unitsMissing,0);
  const repeatExpenses=await runFrontDailyExpenses(admin,new Date('2026-11-08T18:00:00Z'));
  assert.equal(repeatExpenses.processed,0,'daily cost and supply consumption occur only once per reset');
  const [[balanceAfterExpense]]=await admin.execute('SELECT balance FROM order_fronts WHERE id=?',[frontId]);
  assert.equal(Number(balanceAfterExpense.balance),24,'gil is spent only on rent and upkeep, not crafted supplies');
  const [[consumedStock]]=await admin.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id="iron-ingot"',[frontId]);
  assert.equal(Number(consumedStock.quantity),0);
  const [[dailySupplyRecord]]=await admin.execute('SELECT required_quantity,consumed_quantity,missing_quantity FROM order_front_daily_supplies WHERE front_id=?',[frontId]);
  assert.equal(Number(dailySupplyRecord.consumed_quantity),2);
  const [[playerMoney]]=await admin.execute('SELECT balance FROM character_wallets WHERE character_id=?',[char.body.id]);
  assert.equal(Number(playerMoney.balance),13,'front overhead never deducts the wallet, including the prior one-gil low-funds payroll');
  const suspend=await frontsRoute(admin,request('POST',{status:'suspended'}),'/fronts/'+frontId+'/status');
  assert.equal(suspend.status,200);
  const closedFrontShipment=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:1,front_id:frontId}),'/commerce/contracts/'+newFrontOrder.body.id+'/deliver');
  assert.equal(closedFrontShipment.status,403,'suspended business cannot execute trades');
  const reopen=await frontsRoute(admin,request('POST',{status:'active'}),'/fronts/'+frontId+'/status');
  assert.equal(reopen.status,200);
  const returned=await frontsRoute(admin,request('POST',{material_id:'iron-ingot',quantity:1,direction:'return',character_id:char.body.id}),'/fronts/'+frontId+'/stock');
  assert.equal(returned.status,409,'used daily supplies cannot be returned or traded a second time');
  const [[remainingFrontStock]]=await admin.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id="iron-ingot"',[frontId]);
  assert.equal(Number(remainingFrontStock.quantity),0);
  const [frontLedgers]=await admin.execute('SELECT kind,amount FROM order_front_ledger WHERE front_id=? ORDER BY id',[frontId]);
  assert.deepEqual(frontLedgers.map(x=>x.kind),['trade_income','operating_expense']);
  const [[newTreasuryBalance]]=await admin.execute('SELECT balance FROM order_treasury WHERE id=1');
  assert.equal(Number(newTreasuryBalance.balance),12,'only real Order share enters funds available for daily pay');
  await admin.query(await readFile(new URL('../sql/028_order_fronts.sql',import.meta.url),'utf8'));
  await admin.query(await readFile(new URL('../sql/029_front_auto_expenses.sql',import.meta.url),'utf8'));
  await admin.query(await readFile(new URL('../sql/030_front_material_supplies.sql',import.meta.url),'utf8'));
  const missingSupplyCycle=await runFrontDailyExpenses(admin,new Date('2026-11-09T16:00:00Z'));
  assert.equal(missingSupplyCycle.unitsConsumed,0);
  assert.equal(missingSupplyCycle.unitsMissing,2,'missing crafted goods are recorded, never replaced by gil');
  const [[frontAfterMigration]]=await admin.execute('SELECT balance FROM order_fronts WHERE id=?',[frontId]);
  assert.equal(Number(frontAfterMigration.balance),20,'migration rerun preserves the balance after the second real daily rent and upkeep deduction');
  // Protect crafted batches from FC consumption until their maker explicitly routes them.
  await admin.execute("INSERT INTO fc_material_stock(material_id,quantity) VALUES('iron-ore',20) ON DUPLICATE KEY UPDATE quantity=20");
  const [[sharedBefore]]=await admin.execute("SELECT quantity FROM fc_material_stock WHERE material_id='iron-ingot'");
  const reservedCraft=await craftingRoute(admin,request('POST',{recipe_id:'smelt-iron',quantity:3,character_id:char.body.id,destination:'reserved'}),'/workshop/craft');
  assert.equal(reservedCraft.status,200,JSON.stringify(reservedCraft.body));
  assert.equal(reservedCraft.body.produced,3);
  const [[sharedAfter]]=await admin.execute("SELECT quantity FROM fc_material_stock WHERE material_id='iron-ingot'");
  assert.equal(Number(sharedAfter.quantity),Number(sharedBefore.quantity),'reserved output never enters shared FC stores');
  const reservedList=await craftingRoute(admin,request('GET'),'/workshop/reserved');
  assert.equal(Number(reservedList.body.goods.find(g=>g.material_id==='iron-ingot').quantity),3);
  const otherPersonRelease=await craftingRoute(admin,recruitRequest('POST',{character_id:char.body.id,material_id:'iron-ingot',quantity:1}),'/workshop/reserved/release');
  assert.equal(otherPersonRelease.status,403,"other members cannot release someone else's reserved craft");
  const unauthorizedFrontTransfer=await frontsRoute(admin,recruitRequest('POST',{character_id:char.body.id,material_id:'iron-ingot',quantity:1}),'/fronts/'+frontId+'/reserved-stock');
  assert.equal(unauthorizedFrontTransfer.status,403,'front officer cannot seize another maker\'s reserved goods');
  const frontReservedTransfer=await frontsRoute(admin,request('POST',{character_id:char.body.id,material_id:'iron-ingot',quantity:2}),'/fronts/'+frontId+'/reserved-stock');
  assert.equal(frontReservedTransfer.status,200,JSON.stringify(frontReservedTransfer.body));
  const [[lockedRemaining]]=await admin.execute("SELECT quantity FROM character_reserved_materials WHERE character_id=? AND material_id='iron-ingot'",[char.body.id]);
  assert.equal(Number(lockedRemaining.quantity),1);
  const [[newFrontStock]]=await admin.execute("SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id='iron-ingot'",[frontId]);
  assert.equal(Number(newFrontStock.quantity),2);
  const overdrawReserved=await frontsRoute(admin,request('POST',{character_id:char.body.id,material_id:'iron-ingot',quantity:2}),'/fronts/'+frontId+'/reserved-stock');
  assert.equal(overdrawReserved.status,409,'reserved batches cannot be double-delivered');
  const voluntaryRelease=await craftingRoute(admin,request('POST',{character_id:char.body.id,material_id:'iron-ingot',quantity:1}),'/workshop/reserved/release');
  assert.equal(voluntaryRelease.status,200);
  const [[sharedReleased]]=await admin.execute("SELECT quantity FROM fc_material_stock WHERE material_id='iron-ingot'");
  assert.equal(Number(sharedReleased.quantity),Number(sharedBefore.quantity)+1,'only deliberate release increases shared stock');
  await admin.query(await readFile(new URL('../sql/031_character_reserved_goods.sql',import.meta.url),'utf8'));
  const [[savedReserved]]=await admin.execute("SELECT quantity FROM character_reserved_materials WHERE character_id=? AND material_id='iron-ingot'",[char.body.id]);
  assert.equal(Number(savedReserved.quantity),0,'re-running migrations preserves consumed reserved balances');
  // An older migration was deliberately replayed above. Reapply the current stock-audit enum extension, as setup:local does in order.
  await admin.query(await readFile(new URL('../sql/032_construction_projects.sql',import.meta.url),'utf8'));
  // Preplan a long-form event storyline before it is opened to players.
  const plan=await constructionRoute(admin,request('POST',{
   name:'Rebuild the Star Observatory',description:'A long-term construction arc across Order events.',location:'Goblet',
   event_id:eventId,stages:[
    {name:'Clear the ruins',description:'Recover the old foundations',requirements:[{material_id:'iron-ingot',quantity:2}]},
    {name:'Raise the observatory',description:'Fit the structure and roof',requirements:[{material_id:'iron-ingot',quantity:1}]}
   ]}),'/construction');
  assert.equal(plan.status,200,JSON.stringify(plan.body));
  const projectId=plan.body.id;
  let projectBefore=await constructionRoute(admin,request('GET'),'/construction/'+projectId);
  assert.equal(projectBefore.body.project.state,'draft');
  const revised=await constructionRoute(admin,request('PUT',{
   name:'Rebuild the Star Observatory',description:'A construction plot planned before a multi-session event.',location:'Goblet',
   event_id:eventId,stages:[
    {name:'Clear the ruins',description:'Clear debris and recover foundations',requirements:[{material_id:'iron-ingot',quantity:2}]},
    {name:'Raise the observatory',description:'Fit the beams and roof',requirements:[{material_id:'iron-ingot',quantity:1}]}
   ]}),'/construction/'+projectId);
  assert.equal(revised.status,200,'director can revise a private plan before publication');
  projectBefore=await constructionRoute(admin,request('GET'),'/construction/'+projectId);
  assert.match(projectBefore.body.project.description,/multi-session/);
  const secondEpisodeId='ffffffff-ffff-4fff-8fff-ffffffffffff';
  await admin.execute('INSERT INTO order_encounters(id,name,notes,themes,created_by,description) VALUES(?,?,?,JSON_ARRAY(),?,?)',
   [secondEpisodeId,'Observatory: The Raising','',id,'Later chapter of the reconstruction plot']);
  const linkedEpisode=await constructionRoute(admin,request('POST',{event_id:secondEpisodeId}),'/construction/'+projectId+'/events');
  assert.equal(linkedEpisode.status,200,'later RP sessions can join an established construction arc');
  const twoEpisodeProject=await constructionRoute(admin,request('GET'),'/construction/'+projectId);
  assert.equal(twoEpisodeProject.body.project.linked_events.length,2);
  const projectDirectory=await constructionRoute(admin,request('GET'),'/construction');
  assert.ok(projectDirectory.body.projects.find(p=>Number(p.id)===Number(projectId)).event_ids.includes(secondEpisodeId));

  const hidden=await constructionRoute(admin,recruitRequest('GET'),'/construction/'+projectId);
  assert.equal(hidden.status,404,'private storyline stays hidden until published');
  const premature=await constructionRoute(admin,request('POST',{requirement_id:projectBefore.body.project.stages[0].requirements[0].id,character_id:char.body.id,quantity:1,source:'shared'}),'/construction/'+projectId+'/contribute');
  assert.equal(premature.status,409,'draft projects cannot receive materials');
  const activated=await constructionRoute(admin,request('POST'),'/construction/'+projectId+'/activate');
  assert.equal(activated.body.state,'open');
  const rewriteLive=await constructionRoute(admin,request('PUT',{
   name:'Attempted rewrite',description:'',location:'',event_id:null,
   stages:[{name:'Skip phase',description:'',requirements:[{material_id:'iron-ingot',quantity:1}]}]
  }),'/construction/'+projectId);
  assert.equal(rewriteLive.status,409,'published construction phases cannot be rewritten after contributions become possible');
  const first=projectBefore.body.project.stages[0],second=projectBefore.body.project.stages[1];
  const locked=await constructionRoute(admin,request('POST',{requirement_id:second.requirements[0].id,character_id:char.body.id,quantity:1,source:'shared'}),'/construction/'+projectId+'/contribute');
  assert.equal(locked.status,409,'future story phases cannot accept stock early');
  const unauthorized=await constructionRoute(admin,recruitRequest('POST',{requirement_id:first.requirements[0].id,character_id:char.body.id,quantity:1,source:'shared'}),'/construction/'+projectId+'/contribute');
  assert.equal(unauthorized.status,403,'cannot supply a project using a character owned by someone else');
  const earlySignOff=await constructionRoute(admin,request('POST'),'/construction/'+projectId+'/stages/'+first.id+'/complete');
  assert.equal(earlySignOff.status,409,'director cannot skip construction supplies');
  const contribution=await constructionRoute(admin,request('POST',{requirement_id:first.requirements[0].id,character_id:char.body.id,quantity:1,source:'shared'}),'/construction/'+projectId+'/contribute');
  assert.equal(contribution.status,200,JSON.stringify(contribution.body));
  const overfilled=await constructionRoute(admin,request('POST',{requirement_id:first.requirements[0].id,character_id:char.body.id,quantity:2,source:'shared'}),'/construction/'+projectId+'/contribute');
  assert.equal(overfilled.status,409,'cannot submit more than remaining target');
  const secondDelivery=await constructionRoute(admin,request('POST',{requirement_id:first.requirements[0].id,character_id:char.body.id,quantity:1,source:'shared'}),'/construction/'+projectId+'/contribute');
  assert.equal(secondDelivery.status,200);
  const nextStage=await constructionRoute(admin,request('POST'),'/construction/'+projectId+'/stages/'+first.id+'/complete');
  assert.equal(nextStage.body.state,'next_stage');
  const secondSignOffAttempt=await constructionRoute(admin,request('POST'),'/construction/'+projectId+'/stages/'+first.id+'/complete');
  assert.equal(secondSignOffAttempt.status,409,'stage advances only once');
  await admin.execute("INSERT INTO fc_material_stock(material_id,quantity) VALUES('iron-ore',6) ON DUPLICATE KEY UPDATE quantity=6");
  const freshReserved=await craftingRoute(admin,request('POST',{recipe_id:'smelt-iron',quantity:1,character_id:char.body.id,destination:'reserved'}),'/workshop/craft');
  assert.equal(freshReserved.status,200);
  const protectedContribution=await constructionRoute(admin,request('POST',{requirement_id:second.requirements[0].id,character_id:char.body.id,quantity:1,source:'reserved'}),'/construction/'+projectId+'/contribute');
  assert.equal(protectedContribution.status,200,'player intentionally contributes their locked craft');
  const finish=await constructionRoute(admin,request('POST'),'/construction/'+projectId+'/stages/'+second.id+'/complete');
  assert.equal(finish.body.state,'completed');
  const finalProject=await constructionRoute(admin,request('GET'),'/construction/'+projectId);
  assert.equal(finalProject.body.project.history.length,3);
  assert.equal(finalProject.body.project.state,'completed');
  assert.equal(finalProject.body.project.event_id,eventId);
  const unlinked=await constructionRoute(admin,request('DELETE'),'/construction/'+projectId+'/events/'+secondEpisodeId);
  assert.equal(unlinked.status,200);
  const afterUnlink=await constructionRoute(admin,request('GET'),'/construction/'+projectId);
  assert.equal(afterUnlink.body.project.linked_events.length,1,'unlinking an event does not remove the construction project');
  assert.equal(afterUnlink.body.project.history.length,3,'event link changes do not affect material contributions');
  await admin.query(await readFile(new URL('../sql/032_construction_projects.sql',import.meta.url),'utf8'));
  const [[persisted]]=await admin.execute('SELECT COUNT(*) AS n FROM order_construction_contributions WHERE project_id=?',[projectId]);
  assert.equal(Number(persisted.n),3,'repeat setup preserves long-running construction history');







 }finally{await admin.end();}
});
