-- Additive industrial site hosts and earned utility infrastructure.
-- Existing settlement factories and their stocks, projects and history stay intact.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_industry_locations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 site_type ENUM('farm','orchard','mine','quarry','lumberyard','fishery','refinery','factory','power_plant','workshop','outpost','other') NOT NULL DEFAULT 'farm',
 region_id BIGINT UNSIGNED NOT NULL,
 zone_id BIGINT UNSIGNED NOT NULL,
 controlling_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 map_x DECIMAL(5,2) NOT NULL DEFAULT 50,
 map_y DECIMAL(5,2) NOT NULL DEFAULT 50,
 description VARCHAR(500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(zone_id) REFERENCES world_zones(id),
 FOREIGN KEY(controlling_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CHECK(map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100),
 INDEX ix_industry_locations_zone(region_id,zone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE world_industry_facilities MODIFY COLUMN settlement_id BIGINT UNSIGNED NULL;
SET @ddl := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_facilities ADD COLUMN location_id BIGINT UNSIGNED NULL',
 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_industry_facilities' AND column_name='location_id');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_facilities ADD CONSTRAINT fk_industry_location FOREIGN KEY(location_id) REFERENCES world_industry_locations(id) ON DELETE RESTRICT',
 'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name='world_industry_facilities' AND constraint_name='fk_industry_location');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS world_industry_utilities (
 project_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 facility_id BIGINT UNSIGNED NOT NULL,
 kind ENUM('power','heat') NOT NULL,
 units TINYINT UNSIGNED NOT NULL DEFAULT 10,
 completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(project_id) REFERENCES world_industry_projects(id),
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id),
 CHECK(units=10),
 INDEX ix_industry_utilities(facility_id,kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @ddl := (SELECT IF(COUNT(*)=0,
 "ALTER TABLE world_industry_projects ADD COLUMN utility_kind ENUM('none','power','heat') NOT NULL DEFAULT 'none'",
 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_industry_projects' AND column_name='utility_kind');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
INSERT INTO schema_migrations(version) VALUES('055_independent_industry_sites') ON DUPLICATE KEY UPDATE version=VALUES(version);
