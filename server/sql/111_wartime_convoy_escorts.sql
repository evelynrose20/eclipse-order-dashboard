-- Assign real Order garrison personnel to transport protection, preserving war and freight history.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_convoy_escorts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 shipment_kind ENUM('freight','supply') NOT NULL,
 shipment_id BIGINT UNSIGNED NOT NULL,
 installation_id BIGINT UNSIGNED NOT NULL,
 troop_type VARCHAR(80) NOT NULL,
 troops INT UNSIGNED NOT NULL,
 assigned_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_convoy_escort(shipment_kind,shipment_id),
 INDEX ix_escort_garrison(installation_id,troop_type),
 FOREIGN KEY (installation_id) REFERENCES world_military_installations(id),
 FOREIGN KEY (assigned_by) REFERENCES accounts(id),
 CONSTRAINT chk_convoy_escort_troops CHECK(troops>=1 AND troops<=1000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_convoy_engagements (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 shipment_kind ENUM('freight','supply') NOT NULL,
 shipment_id BIGINT UNSIGNED NOT NULL,
 escort_id BIGINT UNSIGNED NULL,
 threat VARCHAR(150) NOT NULL DEFAULT 'Hostile forces reported',
 severity TINYINT UNSIGNED NOT NULL DEFAULT 2,
 status ENUM('pending','secured','held') NOT NULL DEFAULT 'pending',
 detail VARCHAR(500) NOT NULL DEFAULT '',
 reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 reviewed_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_convoy_battle(shipment_kind,shipment_id,status),
 FOREIGN KEY (escort_id) REFERENCES world_convoy_escorts(id),
 FOREIGN KEY (reviewed_by) REFERENCES accounts(id),
 CONSTRAINT chk_convoy_battle_severity CHECK(severity BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES ('111_wartime_convoy_escorts')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
