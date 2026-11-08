-- Autonomous settlement history is isolated from Order stock and RP governance.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_settlement_autosim (
 settlement_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 mode ENUM('off','automatic') NOT NULL DEFAULT 'automatic',
 cadence ENUM('slow','normal','fast') NOT NULL DEFAULT 'normal',
 paused TINYINT(1) NOT NULL DEFAULT 0,
 last_cycle_key VARCHAR(35) NULL,
 food_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 fuel_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 water_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 medicine_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 development_points DECIMAL(14,3) NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_settlement_sim_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 cycle_key VARCHAR(35) NOT NULL,
 cycle_date DATE NOT NULL,
 origin ENUM('npc','order') NOT NULL,
 population_before INT UNSIGNED NOT NULL,
 population_after INT UNSIGNED NOT NULL,
 workforce_after INT UNSIGNED NOT NULL,
 condition_before TINYINT UNSIGNED NOT NULL,
 condition_after TINYINT UNSIGNED NOT NULL,
 food_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 water_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 fuel_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 medicine_units DECIMAL(14,3) NOT NULL DEFAULT 0,
 development_points DECIMAL(14,3) NOT NULL DEFAULT 0,
 event_type VARCHAR(45) NOT NULL DEFAULT 'routine',
 headline VARCHAR(160) NOT NULL DEFAULT '',
 report JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_settlement_cycle(settlement_id,cycle_key),
 INDEX ix_world_sim_history_date(settlement_id,cycle_date,id),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_npc_construction (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 kind ENUM('housing','defenses','clinic','waterworks','market') NOT NULL,
 name VARCHAR(120) NOT NULL,
 status ENUM('building','completed') NOT NULL DEFAULT 'building',
 progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
 started_on DATE NOT NULL,
 finished_on DATE NULL,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 INDEX ix_world_npc_projects(settlement_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Manual cycle records may also be produced by the system without impersonating a staff account.
ALTER TABLE world_civic_cycles MODIFY COLUMN actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL;
ALTER TABLE world_civic_movements MODIFY COLUMN actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL;
INSERT INTO schema_migrations(version) VALUES('053_autonomous_settlement_simulation') ON DUPLICATE KEY UPDATE version=VALUES(version);
