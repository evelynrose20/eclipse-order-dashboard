-- Garlean lore-grounded equipment catalog, large warships and complete rail consists.
-- All entries below are design blueprints ONLY: no vehicle, factory stock or project is granted.
USE eclipse_order;
ALTER TABLE world_magitek_equipment_templates MODIFY COLUMN equipment_kind
 ENUM('transport','locomotive','railcar','armored_vehicle','airship','capital_airship','field_equipment','siege_equipment','other') NOT NULL;
SET @status_sql := (SELECT IF(COUNT(*)=0,
 "ALTER TABLE world_magitek_equipment_templates ADD COLUMN lore_status ENUM('canon_class','canon_vehicle','lore_adapted','original') NOT NULL DEFAULT 'original'",
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_magitek_equipment_templates' AND column_name='lore_status');
PREPARE garlean_status_stmt FROM @status_sql; EXECUTE garlean_status_stmt; DEALLOCATE PREPARE garlean_status_stmt;
SET @reference_sql := (SELECT IF(COUNT(*)=0,
 "ALTER TABLE world_magitek_equipment_templates ADD COLUMN lore_reference VARCHAR(500) NOT NULL DEFAULT ''",
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_magitek_equipment_templates' AND column_name='lore_reference');
PREPARE garlean_reference_stmt FROM @reference_sql; EXECUTE garlean_reference_stmt; DEALLOCATE PREPARE garlean_reference_stmt;
SET @wagons_sql := (SELECT IF(COUNT(*)=0,
 "ALTER TABLE world_magitek_equipment_templates ADD COLUMN max_wagons SMALLINT UNSIGNED NOT NULL DEFAULT 0",
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_magitek_equipment_templates' AND column_name='max_wagons');
PREPARE garlean_wagons_stmt FROM @wagons_sql; EXECUTE garlean_wagons_stmt; DEALLOCATE PREPARE garlean_wagons_stmt;
SET @check_sql := (SELECT IF(COUNT(*)>0, 'ALTER TABLE world_magitek_equipment_templates DROP CHECK chk_magitek_capacity', 'DO 0') FROM information_schema.table_constraints WHERE table_schema=DATABASE() AND table_name='world_magitek_equipment_templates' AND constraint_name='chk_magitek_capacity');
PREPARE garlean_check_stmt FROM @check_sql; EXECUTE garlean_check_stmt; DEALLOCATE PREPARE garlean_check_stmt;
ALTER TABLE world_magitek_equipment_templates ADD CONSTRAINT chk_magitek_capacity CHECK(
 transport_capacity<=10000 AND cargo_capacity<=100000 AND crew_required<=1000
 AND fuel_per_operation>=0 AND fuel_per_operation<=10000 AND max_wagons<=100);
CREATE TABLE IF NOT EXISTS world_magitek_train_consists (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 owner_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 locomotive_lot_id BIGINT UNSIGNED NOT NULL,
 status ENUM('assembled','disbanded') NOT NULL DEFAULT 'assembled',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 disbanded_at DATETIME NULL,
 FOREIGN KEY(owner_faction_id) REFERENCES order_factions(id),
 FOREIGN KEY(locomotive_lot_id) REFERENCES world_magitek_equipment_inventory(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_magitek_train_owner(owner_faction_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_magitek_train_cars (
 consist_id BIGINT UNSIGNED NOT NULL,
 car_lot_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(consist_id,car_lot_id),
 KEY ix_magitek_train_car_lot(car_lot_id),
 FOREIGN KEY(consist_id) REFERENCES world_magitek_train_consists(id),
 FOREIGN KEY(car_lot_id) REFERENCES world_magitek_equipment_inventory(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_magitek_train_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 consist_id BIGINT UNSIGNED NOT NULL,
 action ENUM('assemble','disband') NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 description VARCHAR(300) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(consist_id) REFERENCES world_magitek_train_consists(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 KEY ix_magitek_train_events(consist_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Values are RP simulation defaults, not claimed canonical specifications.
-- A seed creates an item blueprint and its equipment definition, never completed stock.
INSERT IGNORE INTO world_industry_items(id,name,category,description) VALUES
 ('garlean-reaper','Magitek Reaper','equipment','FFXIV canonical Garlean combat magitek type; simulated specification'),
 ('garlean-vanguard','Magitek Vanguard','equipment','FFXIV canonical Garlean autonomous siege machine; simulated specification'),
 ('garlean-colossus','Magitek Colossus','equipment','FFXIV canonical Garlean autonomous magitek armor; simulated specification'),
 ('garlean-juggernaut','Magitek Juggernaut','equipment','FFXIV canonical airborne troop transport; simulated specification'),
 ('garlean-gunship','Imperial Magitek Gunship','equipment','FFXIV canonical imperial gunship type; simulated specification'),
 ('garlean-assault-craft','Imperial Assault Craft','equipment','FFXIV canonical imperial assault craft; simulated specification'),
 ('garlean-aurora','Aurora-class Warship','equipment','FFXIV canonical medium imperial airship class; simulated specification'),
 ('garlean-agrius','Agrius-class Flying Fortress','equipment','FFXIV canonical enormous imperial flying-fortress class; simulated specification'),
 ('garlean-mark-xlix','Mark XLIX Passenger Train','equipment','FFXIV documented Garlean passenger train model; represented as a locomotive/trainset for simulation'),
 ('order-freight-locomotive','Imperial-style Freight Locomotive','equipment','Lore-inspired RP design: no verified official general locomotive model name'),
 ('order-freight-carriage','Imperial-style Freight Railcar','equipment','Lore-inspired RP carriage design'),
 ('order-troop-carriage','Imperial-style Troop Railcar','equipment','Lore-inspired RP troop carriage');
INSERT IGNORE INTO world_magitek_equipment_templates
 (item_id,equipment_kind,name,description,transport_capacity,cargo_capacity,crew_required,
  fuel_item_id,fuel_per_operation,enabled,lore_status,lore_reference,max_wagons)
 VALUES
 ('garlean-reaper','armored_vehicle','Magitek Reaper','Imperial reaper-type battle armor; gameplay capacity estimates.',1,0,1,'ceruleum-fuel',1,1,'canon_vehicle','FFXIV official ARR world lore: Reaper',0),
 ('garlean-vanguard','siege_equipment','Magitek Vanguard','Autonomous imperial breach and defensive unit; gameplay estimate.',0,5,0,'ceruleum-fuel',2,1,'canon_vehicle','FFXIV official ARR world lore: Vanguard',0),
 ('garlean-colossus','siege_equipment','Magitek Colossus','Unmanned modular imperial magitek armor; gameplay estimate.',0,5,0,'ceruleum-fuel',2,1,'canon_vehicle','Encyclopaedia Eorzea / Garlean Empire: Colossi',0),
 ('garlean-juggernaut','airship','Magitek Juggernaut','Flying/walking Garlean troop carrier; gameplay estimate.',12,10,2,'ceruleum-fuel',2,1,'canon_vehicle','FFXIV official ARR world lore: Juggernaut',0),
 ('garlean-gunship','airship','Imperial Magitek Gunship','Small armed imperial aerial support vessel; gameplay estimate.',6,10,3,'ceruleum-fuel',3,1,'canon_class','Encyclopaedia Eorzea: Imperial gunships',0),
 ('garlean-assault-craft','airship','Imperial Assault Craft','Fast troop transfer and assault vessel; gameplay estimate.',16,12,3,'ceruleum-fuel',4,1,'canon_class','Encyclopaedia Eorzea: Imperial assault craft',0),
 ('garlean-aurora','capital_airship','Aurora-class Warship','Garlean mainstay medium military airship. Class canonical; simulated statistics.',240,600,40,'ceruleum-fuel',35,1,'canon_class','Encyclopaedia Eorzea: Aurora-class airship',0),
 ('garlean-agrius','capital_airship','Agrius-class Flying Fortress','Massive Garlean campaign flagship. Gration is a known comparable ship, not a separate class.',1800,8000,220,'ceruleum-fuel',180,1,'canon_class','Encyclopaedia Eorzea: Agrius and Gration',0),
 ('garlean-mark-xlix','locomotive','Mark XLIX Passenger Train','Documented Garlean passenger train. Treated as a locomotive/trainset in this simulator.',150,30,5,'ceruleum-fuel',4,1,'canon_vehicle','Endwalker Sightseeing Log 28: The Runaway Train',6),
 ('order-freight-locomotive','locomotive','Imperial-style Freight Locomotive','Original RP specification in Garlean industrial style.',8,20,4,'ceruleum-fuel',6,1,'lore_adapted','Garlean railway infrastructure; custom locomotive model',12),
 ('order-freight-carriage','railcar','Imperial-style Freight Railcar','Original RP freight wagon for train consists.',0,120,1,NULL,0,1,'lore_adapted','Custom RP railway carriage',0),
 ('order-troop-carriage','railcar','Imperial-style Troop Railcar','Original RP troop carriage for train consists.',80,15,2,NULL,0,1,'lore_adapted','Custom RP military passenger carriage',0);
INSERT INTO schema_migrations(version) VALUES('072_garlean_equipment_and_train_consists')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
