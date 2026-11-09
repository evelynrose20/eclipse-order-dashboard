-- HOI-style provinces under existing economic zones. Additive: no zones,
-- industrial recipes, factories, settlements, or city projects are rewritten.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_strategic_provinces (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 zone_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL,
 terrain ENUM('plains','forest','hills','mountains','urban','coast','marsh','desert','tundra') NOT NULL DEFAULT 'plains',
 polygon JSON NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_strategic_province_zone(zone_id),
 FOREIGN KEY(zone_id) REFERENCES world_zones(id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_strategic_province_infrastructure (
 province_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 roads TINYINT UNSIGNED NOT NULL DEFAULT 0,
 rail TINYINT UNSIGNED NOT NULL DEFAULT 0,
 fortifications TINYINT UNSIGNED NOT NULL DEFAULT 0,
 power TINYINT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(province_id) REFERENCES world_strategic_provinces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_strategic_province_projects (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 province_id BIGINT UNSIGNED NOT NULL,
 sponsor_settlement_id BIGINT UNSIGNED NOT NULL,
 owner_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 project_type ENUM('roads','rail','fortifications','power') NOT NULL,
 level_after TINYINT UNSIGNED NOT NULL,
 development_cost DECIMAL(14,3) NOT NULL,
 cycle_key VARCHAR(35) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_province_cycle(province_id,cycle_key),
 KEY ix_province_projects(province_id,id),
 FOREIGN KEY(province_id) REFERENCES world_strategic_provinces(id) ON DELETE CASCADE,
 FOREIGN KEY(sponsor_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(owner_faction_id) REFERENCES order_factions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('076_strategic_provinces')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
