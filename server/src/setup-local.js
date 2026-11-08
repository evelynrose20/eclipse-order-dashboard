import {createPool} from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {askSecret} from './terminal-secret.js';
async function main(){
 if(!process.env.DB_USER||!process.env.DB_PASSWORD)throw new Error('Set DB_USER and DB_PASSWORD in your private server/.env.');
 const adminName=process.env.MIGRATION_DB_USER||'root';
 const adminPassword=await askSecret('Local MySQL administrator password (hidden): ');
 const pool=createPool({host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),
  database:'eclipse_order',user:adminName,password:adminPassword,connectionLimit:1,multipleStatements:true});
 try{
  await pool.query("CREATE TABLE IF NOT EXISTS account_sessions ("+
   "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,"+
   "account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,"+
   "token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,"+
   "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
   "expires_at DATETIME NOT NULL,revoked_at DATETIME NULL,"+
   "UNIQUE KEY uq_session_hash(token_hash),KEY ix_sessions_account(account_id,expires_at),"+
   "CONSTRAINT fk_sessions_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE"+
   ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  const [cols]=await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='eclipse_order' AND TABLE_NAME='accounts' AND COLUMN_NAME='approval_status'");
  if(!cols.length)await pool.query("ALTER TABLE accounts ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'");
  const [indexes]=await pool.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='eclipse_order' AND TABLE_NAME='accounts' AND INDEX_NAME='ix_accounts_approval'");
  if(!indexes.length)await pool.query('CREATE INDEX ix_accounts_approval ON accounts(approval_status,created_at)');
  await pool.query("INSERT INTO schema_migrations(version) VALUES('002_sessions'),('004_registration') ON DUPLICATE KEY UPDATE version=VALUES(version)");
  // Additive migration is safe for existing accounts and characters; never drops data.
  const features=await readFile(new URL('../sql/005_features.sql',import.meta.url),'utf8');
  await pool.query(features);
  const syndicateRanks=await readFile(new URL('../sql/007_syndicate_ranks.sql',import.meta.url),'utf8');
  await pool.query(syndicateRanks);
  const eventXp=await readFile(new URL('../sql/008_event_xp.sql',import.meta.url),'utf8');
  await pool.query(eventXp);
  const freeMap=await readFile(new URL('../sql/009_free_map_and_statblocks.sql',import.meta.url),'utf8');
  await pool.query(freeMap);
  const homebrew=await readFile(new URL('../sql/010_homebrew_classes.sql',import.meta.url),'utf8');
  await pool.query(homebrew);
  const story=await readFile(new URL('../sql/011_event_story.sql',import.meta.url),'utf8');
  await pool.query(story);
  const archive=await readFile(new URL('../sql/012_encounter_archives.sql',import.meta.url),'utf8');
  await pool.query(archive);
  const npcAllies=await readFile(new URL('../sql/013_npc_allies.sql',import.meta.url),'utf8');
  await pool.query(npcAllies);
  const discord=await readFile(new URL('../sql/014_discord_oauth.sql',import.meta.url),'utf8');
  await pool.query(discord);
  const guildMembership=await readFile(new URL('../sql/015_discord_membership.sql',import.meta.url),'utf8');
  await pool.query(guildMembership);
  const hierarchy=await readFile(new URL('../sql/016_order_hierarchy.sql',import.meta.url),'utf8');
  await pool.query(hierarchy);
  const factions=await readFile(new URL('../sql/017_factions.sql',import.meta.url),'utf8');
  await pool.query(factions);
  const reputation=await readFile(new URL('../sql/018_faction_reputation.sql',import.meta.url),'utf8');
  await pool.query(reputation);
  const settlements=await readFile(new URL('../sql/019_faction_settlements.sql',import.meta.url),'utf8');
  await pool.query(settlements);
  const crafting=await readFile(new URL('../sql/020_fc_crafting_garden.sql',import.meta.url),'utf8');
  await pool.query(crafting);
  const workshopExpansion=await readFile(new URL('../sql/021_workshop_expansion.sql',import.meta.url),'utf8');
  await pool.query(workshopExpansion);
  const expeditionEncounters=await readFile(new URL('../sql/022_expedition_encounters.sql',import.meta.url),'utf8');
  await pool.query(expeditionEncounters);
  const zones=await readFile(new URL('../sql/023_expedition_zones.sql',import.meta.url),'utf8');
  await pool.query(zones);
  const hellshade=await readFile(new URL('../sql/024_hellshade_bloom.sql',import.meta.url),'utf8');
  await pool.query(hellshade);
  const recipeCategories=await readFile(new URL('../sql/025_recipe_categories.sql',import.meta.url),'utf8');
  await pool.query(recipeCategories);
  const tradeEquipment=await readFile(new URL('../sql/026_trade_and_equipment.sql',import.meta.url),'utf8');
  await pool.query(tradeEquipment);
  const payroll=await readFile(new URL('../sql/027_order_treasury_payroll.sql',import.meta.url),'utf8');
  await pool.query(payroll);
  const fronts=await readFile(new URL('../sql/028_order_fronts.sql',import.meta.url),'utf8');
  await pool.query(fronts);
  const frontExpenses=await readFile(new URL('../sql/029_front_auto_expenses.sql',import.meta.url),'utf8');
  await pool.query(frontExpenses);
  const frontProvisions=await readFile(new URL('../sql/030_front_material_supplies.sql',import.meta.url),'utf8');
  await pool.query(frontProvisions);
  const reservedGoods=await readFile(new URL('../sql/031_character_reserved_goods.sql',import.meta.url),'utf8');
  await pool.query(reservedGoods);
  const construction=await readFile(new URL('../sql/032_construction_projects.sql',import.meta.url),'utf8');
  await pool.query(construction);
  const senate=await readFile(new URL('../sql/033_optional_senate.sql',import.meta.url),'utf8');
  await pool.query(senate);
  const governance=await readFile(new URL('../sql/034_live_governance.sql',import.meta.url),'utf8');
  await pool.query(governance);
  const gardenClock=await readFile(new URL('../sql/035_garden_growth_clock.sql',import.meta.url),'utf8');
  await pool.query(gardenClock);
  const senateChamber=await readFile(new URL('../sql/036_senate_governing_chamber.sql',import.meta.url),'utf8');
  await pool.query(senateChamber);
  const loreArchive=await readFile(new URL('../sql/037_order_lore_archive.sql',import.meta.url),'utf8');
  await pool.query(loreArchive);
  const faqSchema=await readFile(new URL('../sql/038_garlean_origin_and_faq.sql',import.meta.url),'utf8');
  await pool.query(faqSchema);
  const historyRevision=await readFile(new URL('../sql/039_garlean_history_revision.sql',import.meta.url),'utf8');
  await pool.query(historyRevision);
  const senatePolitics=await readFile(new URL('../sql/040_senate_politics.sql',import.meta.url),'utf8');
  await pool.query(senatePolitics);
  const worldFoundation=await readFile(new URL('../sql/041_world_administration_foundation.sql',import.meta.url),'utf8');
  await pool.query(worldFoundation);
  const worldMapClimate=await readFile(new URL('../sql/042_world_routes_garlean_weather.sql',import.meta.url),'utf8');
  await pool.query(worldMapClimate);
  const mountainRanges=await readFile(new URL('../sql/043_world_mountain_ranges_order_faction.sql',import.meta.url),'utf8');
  await pool.query(mountainRanges);
  const siteConditions=await readFile(new URL('../sql/044_world_site_conditions.sql',import.meta.url),'utf8');
  await pool.query(siteConditions);
  const transportGraph=await readFile(new URL('../sql/045_world_transport_graph.sql',import.meta.url),'utf8');
  await pool.query(transportGraph);
  const worldZones=await readFile(new URL('../sql/046_world_zones.sql',import.meta.url),'utf8');
  await pool.query(worldZones);
  const railInfrastructure=await readFile(new URL('../sql/047_rail_infrastructure.sql',import.meta.url),'utf8');
  await pool.query(railInfrastructure);
  const railInterzone=await readFile(new URL('../sql/048_rail_interzone_links.sql',import.meta.url),'utf8');
  await pool.query(railInterzone);
  const internalRail=await readFile(new URL('../sql/049_internal_rail_logistics.sql',import.meta.url),'utf8');
  await pool.query(internalRail);
  const railDamage=await readFile(new URL('../sql/050_internal_rail_damaged.sql',import.meta.url),'utf8');
  await pool.query(railDamage);
  const [[count]]=await pool.query('SELECT COUNT(*) AS n FROM accounts');
  if(Number(count.n)>0){console.log('Schema ready. Existing accounts were not changed.');return;}
  console.log('Database schema ready. First authenticate with Discord and use the local owner promotion command.');
 }finally{await pool.end();}
}
main().catch(e=>{console.error('Setup failed:',e.message);process.exitCode=1;});
