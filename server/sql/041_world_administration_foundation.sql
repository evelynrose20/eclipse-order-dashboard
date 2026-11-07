-- Initial living-world administration foundation. No sample settlements or
-- simulation jobs are inserted. All civic changes are explicit and audited.
USE eclipse_order;

CREATE TABLE IF NOT EXISTS world_regions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 description TEXT NOT NULL,
 climate VARCHAR(80) NOT NULL DEFAULT 'temperate',
 weather VARCHAR(80) NOT NULL DEFAULT 'clear',
 temperature_c DECIMAL(6,2) NOT NULL DEFAULT 15,
 simulation_mode ENUM('off','narrative','managed') NOT NULL DEFAULT 'off',
 map_background_url VARCHAR(1500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS world_settlements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL,
 description TEXT NOT NULL,
 directory_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 governing_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 controlling_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 supporting_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 map_x DECIMAL(5,2) NOT NULL DEFAULT 50,
 map_y DECIMAL(5,2) NOT NULL DEFAULT 50,
 strategic_state ENUM('peaceful','contested','occupied','liberated','rebuilding') NOT NULL DEFAULT 'peaceful',
 population INT UNSIGNED NOT NULL DEFAULT 0,
 workforce INT UNSIGNED NOT NULL DEFAULT 0,
 food_days DECIMAL(8,2) NOT NULL DEFAULT 0,
 food_variety TINYINT UNSIGNED NOT NULL DEFAULT 50,
 heating_coverage TINYINT UNSIGNED NOT NULL DEFAULT 50,
 insulation TINYINT UNSIGNED NOT NULL DEFAULT 50,
 housing TINYINT UNSIGNED NOT NULL DEFAULT 50,
 medical_access TINYINT UNSIGNED NOT NULL DEFAULT 50,
 food_access TINYINT UNSIGNED NOT NULL DEFAULT 50,
 security_score TINYINT UNSIGNED NOT NULL DEFAULT 50,
 civil_stability TINYINT UNSIGNED NOT NULL DEFAULT 70,
 unrest TINYINT UNSIGNED NOT NULL DEFAULT 0,
 weather_exposure TINYINT UNSIGNED NOT NULL DEFAULT 50,
 simulation_enabled TINYINT(1) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(directory_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(governing_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(controlling_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(supporting_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 KEY ix_world_region(region_id),
 CONSTRAINT chk_world_coords CHECK(map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100),
 CONSTRAINT chk_world_workforce CHECK(workforce<=population)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS world_administration_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action VARCHAR(45) NOT NULL,
 entity VARCHAR(50) NOT NULL,
 entity_id BIGINT UNSIGNED NOT NULL,
 detail VARCHAR(350) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 KEY ix_world_audit(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO schema_migrations(version) VALUES('041_world_administration_foundation')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
