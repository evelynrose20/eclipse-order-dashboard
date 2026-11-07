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
import {craftingRoute} from '../src/crafting.js';
import {commerceRoute} from '../src/commerce.js';

test('MySQL 8 schemas install together and retain existing Domina on re-run', {skip:process.env.ECLIPSE_CI_MYSQL!=='1'}, async()=>{
 const admin=createPool({
  host:'127.0.0.1',port:3306,user:'root',password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,
  database:'eclipse_order',multipleStatements:true,connectionLimit:1
 });
 try{
  for(const filename of ['001_core.sql','002_sessions.sql','005_features.sql','007_syndicate_ranks.sql','008_event_xp.sql','009_free_map_and_statblocks.sql','010_homebrew_classes.sql','011_event_story.sql','012_encounter_archives.sql','013_npc_allies.sql','014_discord_oauth.sql','015_discord_membership.sql','016_order_hierarchy.sql','017_factions.sql','018_faction_reputation.sql','019_faction_settlements.sql','020_fc_crafting_garden.sql','021_workshop_expansion.sql','022_expedition_encounters.sql','023_expedition_zones.sql','024_hellshade_bloom.sql','025_recipe_categories.sql','026_trade_and_equipment.sql']){
   const sql=await readFile(new URL('../sql/'+filename,import.meta.url),'utf8');
   await admin.query(sql);
  }
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
  assert.equal(seedFactions.length,5);
  assert.equal(seedFactions.find(f=>f.id==='house-kurogane')?.leader,'Lady Reika Kurogane');
  assert.equal(seedFactions.find(f=>f.id==='ashen-veil')?.relationship,'watchful_rival');
  assert.match(seedFactions.find(f=>f.id==='iron-remnant')?.image_reference_url||'',/^https:\/\//);
  await admin.query(await readFile(new URL('../sql/017_factions.sql',import.meta.url),'utf8'));
  const [[seedCount]]=await admin.query('SELECT COUNT(*) AS total FROM order_factions');
  assert.equal(Number(seedCount.total),6,'re-running migration preserves the five initial factions and the new settlement');
  const [fcMaterials]=await admin.query('SELECT id,name FROM fc_materials');
  assert.ok(fcMaterials.some(m=>m.id==='iron-ore'));
  assert.ok(fcMaterials.some(m=>m.id==='duskbloom'));
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
  const contract=await commerceRoute(admin,request('POST',{faction_id:'test-hamlet',title:'Supply settlement metal',description:'Deliver metal to local makers.',item_kind:'material',item_id:'iron-ingot',required_quantity:4,rep_per_unit:2}),'/commerce/contracts');
  assert.equal(contract.status,200,JSON.stringify(contract.body));
  const firstDelivery=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:3}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(firstDelivery.status,200,JSON.stringify(firstDelivery.body));
  assert.equal(firstDelivery.body.reputation_change,6);
  const overDelivery=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:2}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(overDelivery.status,409,'cannot exceed contract remaining amount');
  const completed=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:1}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(completed.status,200);
  assert.equal(completed.body.complete,true);
  const deliverTwice=await commerceRoute(admin,request('POST',{character_id:char.body.id,quantity:1}),'/commerce/contracts/'+contract.body.id+'/deliver');
  assert.equal(deliverTwice.status,409,'completed contract must not double reward');
  const gearContract=await commerceRoute(admin,request('POST',{faction_id:'test-hamlet',title:'Settlement tools',description:'Deliver a crafted mining pick.',item_kind:'equipment',item_id:'field-pick',required_quantity:1,rep_per_unit:3}),'/commerce/contracts');
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



 }finally{await admin.end();}
});
