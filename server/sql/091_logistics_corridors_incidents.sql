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
 construction_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 construction_quantity DECIMAL(15,3) NOT NULL,
 FOREIGN KEY(construction_item_id) REFERENCES world_industry_items(id),
 CONSTRAINT ck_freight_corridor_materials CHECK(construction_quantity>0),
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
ALTER TABLE world_industry_ledger MODIFY COLUMN action ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit','military_supply','freight_dispatch','freight_arrival','freight_refund','freight_fuel','civic_delivery','corridor_build','military_delivery') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('091_logistics_corridors_incidents')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
