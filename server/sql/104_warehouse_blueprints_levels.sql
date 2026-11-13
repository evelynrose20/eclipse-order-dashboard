-- Non-destructive warehouse building catalog and level progression.
-- Existing stock and warehouse IDs are preserved; no direct storage-size edits.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_warehouse_blueprints (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 description VARCHAR(350) NOT NULL DEFAULT '',
 icon VARCHAR(48) NOT NULL DEFAULT 'fa-warehouse',
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_warehouse_blueprint_levels (
 blueprint_id BIGINT UNSIGNED NOT NULL,
 level_number SMALLINT UNSIGNED NOT NULL,
 capacity_units INT UNSIGNED NOT NULL,
 requirements JSON NOT NULL,
 PRIMARY KEY (blueprint_id,level_number),
 FOREIGN KEY (blueprint_id) REFERENCES world_logistics_warehouse_blueprints(id),
 CONSTRAINT chk_warehouse_blueprint_level CHECK(level_number BETWEEN 1 AND 20),
 CONSTRAINT chk_warehouse_blueprint_capacity CHECK(capacity_units BETWEEN 100 AND 100000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_warehouse_progress (
 warehouse_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 blueprint_id BIGINT UNSIGNED NOT NULL,
 level_number SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY (warehouse_id) REFERENCES world_logistics_warehouses(id),
 FOREIGN KEY (blueprint_id) REFERENCES world_logistics_warehouse_blueprints(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_warehouse_build_orders (
 warehouse_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 target_level SMALLINT UNSIGNED NOT NULL,
 requirements JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (warehouse_id) REFERENCES world_logistics_warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO world_logistics_warehouse_blueprints(id,name,description,icon,active) VALUES
 (1,'Supply Depot','Compact supply storage for outposts and farms','fa-warehouse',1),
 (2,'Regional Storehouse','Regional reserves and civilian distribution','fa-building',1),
 (3,'Grand Imperial Warehouse','Strategic cargo vaults for the capital','fa-city',1)
 ON DUPLICATE KEY UPDATE id=VALUES(id);
-- Seed deterministic structural iron, never whichever refined/supply item sorts first.
-- Existing designs are preserved; corrective migration 130 handles legacy fish recipes.
INSERT IGNORE INTO world_logistics_warehouse_blueprint_levels(blueprint_id,level_number,capacity_units,requirements)
SELECT b.id,lv.level_number,CASE b.id WHEN 1 THEN 500 WHEN 2 THEN 2000 ELSE 6000 END*lv.level_number,
 IFNULL(JSON_ARRAY(JSON_OBJECT('item_id',(SELECT id FROM world_industry_items WHERE id='iron-ingot' LIMIT 1),'quantity',CASE b.id WHEN 1 THEN 30 WHEN 2 THEN 100 ELSE 300 END*lv.level_number)),JSON_ARRAY())
 FROM world_logistics_warehouse_blueprints b
 CROSS JOIN (SELECT 1 AS level_number UNION ALL SELECT 2 UNION ALL SELECT 3) lv
 WHERE b.id IN (1,2,3);
-- Backfill legacy warehouses, without changing stored cargo, capacity, or condition.
INSERT IGNORE INTO world_logistics_warehouse_progress(warehouse_id,blueprint_id,level_number)
 SELECT id,CASE tier WHEN 'depot' THEN 1 WHEN 'storehouse' THEN 2 ELSE 3 END,1 FROM world_logistics_warehouses;
INSERT INTO schema_migrations(version) VALUES('104_warehouse_blueprints_levels')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
