-- P2 civilian welfare ledger. No sample population, deliveries or scheduled jobs.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_civic_profiles (
 settlement_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 food_daily_per_resident DECIMAL(8,4) NOT NULL DEFAULT 1,
 heat_daily_per_resident DECIMAL(8,4) NOT NULL DEFAULT 1,
 food_min_days INT UNSIGNED NOT NULL DEFAULT 14,
 minimum_variety INT UNSIGNED NOT NULL DEFAULT 3,
 grace_cycles INT UNSIGNED NOT NULL DEFAULT 2,
 enabled_mode ENUM('off','narrative','managed','detailed') NOT NULL DEFAULT 'off',
 paused TINYINT(1) NOT NULL DEFAULT 0,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 last_cycle_date DATE NULL,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_stock (
 settlement_id BIGINT UNSIGNED NOT NULL,
 item_code VARCHAR(75) NOT NULL,
 item_label VARCHAR(120) NOT NULL,
 resource_kind ENUM('food','fuel','water','medicine') NOT NULL,
 food_group VARCHAR(75) NULL,
 quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
 PRIMARY KEY(settlement_id,item_code),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 CONSTRAINT chk_civic_stock_nonnegative CHECK(quantity>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_movements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 item_code VARCHAR(75) NOT NULL,
 resource_kind VARCHAR(20) NOT NULL,
 food_group VARCHAR(75) NULL,
 quantity_delta DECIMAL(14,3) NOT NULL,
 reason VARCHAR(180) NOT NULL,
 cycle_key VARCHAR(75) NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 INDEX ix_civic_movements_settlement_date(settlement_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_cohorts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 label VARCHAR(120) NOT NULL,
 residents INT UNSIGNED NOT NULL DEFAULT 0,
 employed INT UNSIGNED NOT NULL DEFAULT 0,
 housing_quality TINYINT UNSIGNED NOT NULL DEFAULT 50,
 medical_access TINYINT UNSIGNED NOT NULL DEFAULT 50,
 water_access TINYINT UNSIGNED NOT NULL DEFAULT 50,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_cycles (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 cycle_date DATE NOT NULL,
 mode ENUM('managed','detailed') NOT NULL,
 food_used DECIMAL(14,3) NOT NULL DEFAULT 0,
 fuel_used DECIMAL(14,3) NOT NULL DEFAULT 0,
 before_stability INT NOT NULL,
 after_stability INT NOT NULL,
 before_unrest INT NOT NULL,
 after_unrest INT NOT NULL,
 report JSON NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_civic_cycle(settlement_id,cycle_date),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_incidents (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 kind ENUM('petition','strike','demonstration','relief_request','weather_emergency') NOT NULL,
 title VARCHAR(140) NOT NULL,
 detail TEXT NOT NULL,
 status ENUM('proposed','approved','declined','resolved') NOT NULL DEFAULT 'proposed',
 proposed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TIMESTAMP NULL,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(proposed_by) REFERENCES accounts(id),
 FOREIGN KEY(reviewed_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_region_climate_profiles (
 region_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 monthly_f JSON NOT NULL,
 daily_variation_f DECIMAL(6,2) NOT NULL DEFAULT 10,
 severity_modifier DECIMAL(6,2) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(region_id) REFERENCES world_regions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_weather_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 title VARCHAR(140) NOT NULL,
 weather VARCHAR(80) NOT NULL,
 temperature_f DECIMAL(6,2) NOT NULL,
 starts_on DATE NOT NULL,
 ends_on DATE NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(region_id) REFERENCES world_regions(id) ON DELETE CASCADE,
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_weather_event_region_dates(region_id,starts_on,ends_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_shared_transfers (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 settlement_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_civic_shared_transfer(request_key),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('051_garlean_civic_needs') ON DUPLICATE KEY UPDATE version=VALUES(version);
