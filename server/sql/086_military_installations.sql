-- Military installations are anchored to existing map settlements. No campaign data is deleted.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_military_installations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL UNIQUE,
 name VARCHAR(140) NOT NULL,
 installation_type ENUM('castrum','fort','outpost','airbase','depot','naval_base','command_post') NOT NULL DEFAULT 'castrum',
 condition_pct TINYINT UNSIGNED NOT NULL DEFAULT 100,
 state ENUM('operational','damaged','disabled','destroyed','rebuilding','abandoned') NOT NULL DEFAULT 'operational',
 defenses VARCHAR(500) NOT NULL DEFAULT '',
 notes TEXT NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_military_condition CHECK(condition_pct<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_military_garrisons (
 installation_id BIGINT UNSIGNED NOT NULL,
 troop_type VARCHAR(80) NOT NULL,
 quantity INT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(installation_id,troop_type),
 FOREIGN KEY(installation_id) REFERENCES world_military_installations(id) ON DELETE CASCADE,
 CONSTRAINT chk_military_troops CHECK(quantity<=1000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_military_ammunition (
 installation_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
 PRIMARY KEY(installation_id,item_id),
 FOREIGN KEY(installation_id) REFERENCES world_military_installations(id) ON DELETE CASCADE,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT chk_military_ammo CHECK(quantity>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_military_activity (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 installation_id BIGINT UNSIGNED NOT NULL,
 activity ENUM('create','edit','damage','repair','garrison','ammo_in','ammo_out') NOT NULL,
 detail VARCHAR(500) NOT NULL DEFAULT '',
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(installation_id) REFERENCES world_military_installations(id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 INDEX ix_military_activity(installation_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE world_industry_ledger MODIFY COLUMN action
 ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit','military_supply') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('086_military_installations')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
