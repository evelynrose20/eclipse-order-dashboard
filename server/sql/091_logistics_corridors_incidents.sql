-- Explicit multimodal inter-region corridors and convoy incident decisions.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_corridors (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 origin_settlement_id BIGINT UNSIGNED NOT NULL,
 destination_settlement_id BIGINT UNSIGNED NOT NULL,
 mode ENUM('road','rail','air','sea','pack') NOT NULL,
 state ENUM('planned','operational','damaged','closed') NOT NULL DEFAULT 'planned',
 travel_minutes INT UNSIGNED NOT NULL DEFAULT 120,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_freight_corridor(origin_settlement_id,destination_settlement_id,mode),
 FOREIGN KEY(origin_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(destination_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT ck_freight_corridor_distinct CHECK(origin_settlement_id<>destination_settlement_id),
 CONSTRAINT ck_freight_corridor_minutes CHECK(travel_minutes BETWEEN 1 AND 10080)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_incidents (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 shipment_id BIGINT UNSIGNED NOT NULL UNIQUE,
 incident_type ENUM('blizzard','snowstorm','blocked_corridor','destination_unavailable') NOT NULL,
 severity TINYINT UNSIGNED NOT NULL DEFAULT 1,
 weather_snapshot VARCHAR(180) NOT NULL DEFAULT '',
 disposition ENUM('pending','wait','escort') NOT NULL DEFAULT 'pending',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resolved_at DATETIME NULL,
 resolved_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id),
 FOREIGN KEY(resolved_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('091_logistics_corridors_incidents')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
