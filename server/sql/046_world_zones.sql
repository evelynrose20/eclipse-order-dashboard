-- Additive, repeatable region > zone hierarchy. No existing map is deleted.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_zones (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 slug VARCHAR(80) NOT NULL,
 name VARCHAR(140) NOT NULL,
 description TEXT NOT NULL,
 map_background_url VARCHAR(1500) NOT NULL DEFAULT '',
 strategic_state ENUM('peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed') NOT NULL DEFAULT 'peaceful',
 governing_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 controlling_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 supporting_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 is_default TINYINT(1) NOT NULL DEFAULT 0,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_world_zone_slug(region_id,slug),
 UNIQUE KEY uq_world_zone_region(id,region_id),
 KEY ix_world_zone_region(region_id),
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(governing_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(controlling_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(supporting_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- One initial overview zone per preexisting region: preserve its original map.
INSERT INTO world_zones(region_id,slug,name,description,map_background_url,is_default,created_by)
 SELECT r.id,'overview','Regional Overview','Original regional territory map',r.map_background_url,1,r.created_by
 FROM world_regions r LEFT JOIN world_zones z ON z.region_id=r.id AND z.slug='overview'
 WHERE z.id IS NULL;
-- Repeatable additions, one column on each existing map-owned table.
SET @add_zone_worldsettlements := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_settlements' AND COLUMN_NAME='zone_id')=0,'ALTER TABLE world_settlements ADD COLUMN zone_id BIGINT UNSIGNED NULL','SELECT 1');
PREPARE zone_stmt FROM @add_zone_worldsettlements;
EXECUTE zone_stmt;
DEALLOCATE PREPARE zone_stmt;
UPDATE world_settlements t JOIN world_zones z ON z.region_id=t.region_id AND z.slug='overview' SET t.zone_id=z.id WHERE t.zone_id IS NULL;
SET @add_zone_worldmaproutes := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_map_routes' AND COLUMN_NAME='zone_id')=0,'ALTER TABLE world_map_routes ADD COLUMN zone_id BIGINT UNSIGNED NULL','SELECT 1');
PREPARE zone_stmt FROM @add_zone_worldmaproutes;
EXECUTE zone_stmt;
DEALLOCATE PREPARE zone_stmt;
UPDATE world_map_routes t JOIN world_zones z ON z.region_id=t.region_id AND z.slug='overview' SET t.zone_id=z.id WHERE t.zone_id IS NULL;
SET @add_zone_worldroutenodes := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_route_nodes' AND COLUMN_NAME='zone_id')=0,'ALTER TABLE world_route_nodes ADD COLUMN zone_id BIGINT UNSIGNED NULL','SELECT 1');
PREPARE zone_stmt FROM @add_zone_worldroutenodes;
EXECUTE zone_stmt;
DEALLOCATE PREPARE zone_stmt;
UPDATE world_route_nodes t JOIN world_zones z ON z.region_id=t.region_id AND z.slug='overview' SET t.zone_id=z.id WHERE t.zone_id IS NULL;
SET @add_zone_worldroutesegments := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_route_segments' AND COLUMN_NAME='zone_id')=0,'ALTER TABLE world_route_segments ADD COLUMN zone_id BIGINT UNSIGNED NULL','SELECT 1');
PREPARE zone_stmt FROM @add_zone_worldroutesegments;
EXECUTE zone_stmt;
DEALLOCATE PREPARE zone_stmt;
UPDATE world_route_segments t JOIN world_zones z ON z.region_id=t.region_id AND z.slug='overview' SET t.zone_id=z.id WHERE t.zone_id IS NULL;
SET @add_zone_worldmapmountainranges := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_map_mountain_ranges' AND COLUMN_NAME='zone_id')=0,'ALTER TABLE world_map_mountain_ranges ADD COLUMN zone_id BIGINT UNSIGNED NULL','SELECT 1');
PREPARE zone_stmt FROM @add_zone_worldmapmountainranges;
EXECUTE zone_stmt;
DEALLOCATE PREPARE zone_stmt;
UPDATE world_map_mountain_ranges t JOIN world_zones z ON z.region_id=t.region_id AND z.slug='overview' SET t.zone_id=z.id WHERE t.zone_id IS NULL;
INSERT INTO schema_migrations(version) VALUES('046_world_zones') ON DUPLICATE KEY UPDATE version=VALUES(version);
