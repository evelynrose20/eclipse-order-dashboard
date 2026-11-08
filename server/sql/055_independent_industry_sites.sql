-- Independent industrial holdings for farms, mines, forests and utility sites.
-- Facilities may attach to a mapped industry site without creating fictional civilian residents.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_industry_sites (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 zone_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL,
 kind ENUM('farm','ranch','lumberyard','quarry','mine','refinery','workshop','plant','power','other') NOT NULL DEFAULT 'other',
 description VARCHAR(500) NOT NULL DEFAULT '',
 controlling_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 map_x DECIMAL(5,2) NOT NULL DEFAULT 50,
 map_y DECIMAL(5,2) NOT NULL DEFAULT 50,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(zone_id) REFERENCES world_zones(id),
 FOREIGN KEY(controlling_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_world_industry_site_zone(region_id,zone_id),
 CONSTRAINT chk_industry_site_coordinates CHECK(map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @site_col := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_facilities ADD COLUMN site_id BIGINT UNSIGNED NULL',
 'DO 0') FROM information_schema.columns
 WHERE table_schema=DATABASE() AND table_name='world_industry_facilities' AND column_name='site_id');
PREPARE industry_site_col FROM @site_col;
EXECUTE industry_site_col;
DEALLOCATE PREPARE industry_site_col;
SET @site_fk := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_facilities ADD CONSTRAINT fk_industry_facility_site FOREIGN KEY(site_id) REFERENCES world_industry_sites(id) ON DELETE RESTRICT',
 'DO 0') FROM information_schema.table_constraints
 WHERE table_schema=DATABASE() AND table_name='world_industry_facilities' AND constraint_name='fk_industry_facility_site');
PREPARE industry_site_fk FROM @site_fk;
EXECUTE industry_site_fk;
DEALLOCATE PREPARE industry_site_fk;
-- Existing installations retain all settlement-linked facilities as-is.
SET @old_settlement_required := (SELECT IF(IS_NULLABLE='NO',
 'ALTER TABLE world_industry_facilities MODIFY COLUMN settlement_id BIGINT UNSIGNED NULL',
 'DO 0') FROM information_schema.columns
 WHERE table_schema=DATABASE() AND table_name='world_industry_facilities' AND column_name='settlement_id');
PREPARE industry_settlement_optional FROM @old_settlement_required;
EXECUTE industry_settlement_optional;
DEALLOCATE PREPARE industry_settlement_optional;

-- Safe starter agriculture and forestry catalog. Never rewrite customized items.
INSERT IGNORE INTO world_industry_items(id,name,category,workshop_material_id,description) VALUES
 ('grain','Grain','raw',NULL,'Harvested cereal and staple grain'),
 ('vegetables','Vegetables','raw',NULL,'Harvested field vegetables'),
 ('logs','Raw Logs','raw',NULL,'Timber from working forests'),
 ('sawn-timber','Sawn Timber','refined',NULL,'Processed boards and structural wood'),
 ('animal-produce','Livestock Produce','raw',NULL,'Meat, hides and other ranch goods'),
 ('quarried-stone','Quarried Stone','raw',NULL,'Stone from an active quarry');
-- These are ordinary versioned templates. A staff-published update creates v2;
-- running setup never resets the published version or player progress.
INSERT IGNORE INTO world_industry_templates(name,slug,category,current_version,archived,created_by) VALUES
 ('Working Farmland','starter-working-farmland','agriculture',1,0,NULL),
 ('Logging Camp','starter-logging-camp','extraction',1,0,NULL),
 ('Livestock Ranch','starter-livestock-ranch','agriculture',1,0,NULL),
 ('Stone Quarry','starter-stone-quarry','mine',1,0,NULL),
 ('Timber Mill','starter-timber-mill','manufacturing',1,0,NULL);
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,
 CASE slug
 WHEN 'starter-working-farmland' THEN JSON_OBJECT('inputs',JSON_ARRAY(),'outputs',JSON_ARRAY(JSON_OBJECT('item_id','grain','qty',4),JSON_OBJECT('item_id','vegetables','qty',2)),'byproducts',JSON_ARRAY(),'labor',2,'heat',0,'power',0,'capacity',3,'upgrade_level',1)
 WHEN 'starter-logging-camp' THEN JSON_OBJECT('inputs',JSON_ARRAY(),'outputs',JSON_ARRAY(JSON_OBJECT('item_id','logs','qty',3)),'byproducts',JSON_ARRAY(),'labor',3,'heat',0,'power',0,'capacity',3,'upgrade_level',1)
 WHEN 'starter-livestock-ranch' THEN JSON_OBJECT('inputs',JSON_ARRAY(),'outputs',JSON_ARRAY(JSON_OBJECT('item_id','animal-produce','qty',2)),'byproducts',JSON_ARRAY(),'labor',2,'heat',0,'power',0,'capacity',3,'upgrade_level',1)
 WHEN 'starter-stone-quarry' THEN JSON_OBJECT('inputs',JSON_ARRAY(),'outputs',JSON_ARRAY(JSON_OBJECT('item_id','quarried-stone','qty',4)),'byproducts',JSON_ARRAY(),'labor',3,'heat',0,'power',0,'capacity',3,'upgrade_level',1)
 WHEN 'starter-timber-mill' THEN JSON_OBJECT('inputs',JSON_ARRAY(JSON_OBJECT('item_id','logs','qty',3)),'outputs',JSON_ARRAY(JSON_OBJECT('item_id','sawn-timber','qty',2)),'byproducts',JSON_ARRAY(),'labor',3,'heat',0,'power',1,'capacity',3,'upgrade_level',1)
 END,
 JSON_ARRAY()
 FROM world_industry_templates WHERE slug IN ('starter-working-farmland','starter-logging-camp','starter-livestock-ranch','starter-stone-quarry','starter-timber-mill');

INSERT INTO schema_migrations(version) VALUES('055_independent_industry_sites') ON DUPLICATE KEY UPDATE version=VALUES(version);
