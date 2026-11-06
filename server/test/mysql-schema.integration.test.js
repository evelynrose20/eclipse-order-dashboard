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

test('MySQL 8 schemas install together and retain existing Domina on re-run', {skip:process.env.ECLIPSE_CI_MYSQL!=='1'}, async()=>{
 const admin=createPool({
  host:'127.0.0.1',port:3306,user:'root',password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,
  database:'eclipse_order',multipleStatements:true,connectionLimit:1
 });
 try{
  for(const filename of ['001_core.sql','002_sessions.sql','005_features.sql','007_syndicate_ranks.sql','008_event_xp.sql','009_free_map_and_statblocks.sql','010_homebrew_classes.sql','011_event_story.sql','012_encounter_archives.sql','013_npc_allies.sql','014_discord_oauth.sql','015_discord_membership.sql','016_order_hierarchy.sql','017_factions.sql','018_faction_reputation.sql','019_faction_settlements.sql']){
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

  const [seedFactions]=await admin.query('SELECT id,leader,relationship,image_reference_url FROM order_factions WHERE faction_scope='order_story' ORDER BY sort_order');
  assert.equal(seedFactions.length,5);
  assert.equal(seedFactions.find(f=>f.id==='house-kurogane')?.leader,'Lady Reika Kurogane');
  assert.equal(seedFactions.find(f=>f.id==='ashen-veil')?.relationship,'watchful_rival');
  assert.match(seedFactions.find(f=>f.id==='iron-remnant')?.image_reference_url||'',/^https:\/\//);
  await admin.query(await readFile(new URL('../sql/017_factions.sql',import.meta.url),'utf8'));
  const [[seedCount]]=await admin.query('SELECT COUNT(*) AS total FROM order_factions');
  assert.equal(Number(seedCount.total),6,'re-running migration preserves the five initial factions and the new settlement');
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


 }finally{await admin.end();}
});
