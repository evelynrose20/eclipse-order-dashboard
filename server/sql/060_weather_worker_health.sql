-- Additive weather damage and civilian worker healthcare. Repeatable on Windows.
USE eclipse_order;
SET @weather_condition_column := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_facilities ADD COLUMN equipment_condition TINYINT UNSIGNED NOT NULL DEFAULT 100',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_industry_facilities' AND column_name='equipment_condition');
PREPARE equipment_condition_stmt FROM @weather_condition_column; EXECUTE equipment_condition_stmt; DEALLOCATE PREPARE equipment_condition_stmt;
CREATE TABLE IF NOT EXISTS world_settlement_worker_health (
 settlement_id BIGINT UNSIGNED PRIMARY KEY,
 sick_workers INT UNSIGNED NOT NULL DEFAULT 0,
 injured_workers INT UNSIGNED NOT NULL DEFAULT 0,
 last_care_cycle VARCHAR(35) NULL,
 last_illness_cycle VARCHAR(35) NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_weather_incidents (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 facility_id BIGINT UNSIGNED NOT NULL,
 cycle_key VARCHAR(35) NOT NULL,
 weather VARCHAR(40) NOT NULL,
 temperature_f DECIMAL(7,2) NOT NULL,
 equipment_damage TINYINT UNSIGNED NOT NULL DEFAULT 0,
 crop_loss_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
 injured_workers INT UNSIGNED NOT NULL DEFAULT 0,
 note VARCHAR(200) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_industry_incident_cycle(facility_id,cycle_key),
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('060_weather_worker_health') ON DUPLICATE KEY UPDATE version=VALUES(version);
