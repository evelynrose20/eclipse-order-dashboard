-- World electric plants and an optional power supply for the extraction chamber.
-- Only a real Castrum Moonlight settlement is seeded; no example settlements.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_power_plants(
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL,
 model VARCHAR(100) NOT NULL DEFAULT 'Garlean ceruleum generator',
 condition_pct TINYINT UNSIGNED NOT NULL DEFAULT 100,
 rated_output DECIMAL(10,2) NOT NULL DEFAULT 100,
 fuel_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 fuel_per_day DECIMAL(10,3) NOT NULL DEFAULT 10,
 status ENUM('operational','paused','damaged','destroyed') NOT NULL DEFAULT 'operational',
 last_fuel_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 last_outage_penalty_date DATE NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 INDEX ix_power_settlement(settlement_id),
 CONSTRAINT chk_power_capacity CHECK(rated_output>0 AND fuel_per_day>0 AND fuel_units>=0 AND condition_pct<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_power_consumers(
 consumer_key VARCHAR(64) NOT NULL PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NULL,
 load_units DECIMAL(10,2) NOT NULL DEFAULT 10,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO world_power_consumers(consumer_key,settlement_id,load_units) VALUES('aetheric-chamber',NULL,10);
-- An obsolete damaged power plant, precisely five days of fuel at its current burn rate.
INSERT INTO world_power_plants(settlement_id,name,model,condition_pct,rated_output,fuel_units,fuel_per_day,status)
SELECT s.id,'Castrum Moonlight Auxiliary Generator','Obsolete Garlean Ceruleum Mk.I',32,180,500,100,'damaged'
FROM world_settlements s
WHERE LOWER(TRIM(s.name))='castrum moonlight'
AND NOT EXISTS(SELECT 1 FROM world_power_plants p WHERE p.settlement_id=s.id);
INSERT INTO schema_migrations(version) VALUES('123_world_power_grid') ON DUPLICATE KEY UPDATE version=VALUES(version);
