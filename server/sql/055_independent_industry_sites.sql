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
INSERT INTO schema_migrations(version) VALUES('055_independent_industry_sites') ON DUPLICATE KEY UPDATE version=VALUES(version);
