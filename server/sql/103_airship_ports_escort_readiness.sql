-- Airship infrastructure, condition, command-authorized escorts and risk decisions.
-- No sea routes, ships or pack-animal fleet records are created.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_airfields (
 settlement_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 status ENUM('operational','closed','damaged') NOT NULL DEFAULT 'operational',
 built_from_facility_id BIGINT UNSIGNED NOT NULL,
 construction_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 construction_quantity DECIMAL(15,3) NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_airfield_settlement FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 CONSTRAINT fk_airfield_depot FOREIGN KEY(built_from_facility_id) REFERENCES world_industry_facilities(id),
 CONSTRAINT fk_airfield_item FOREIGN KEY(construction_item_id) REFERENCES world_industry_items(id),
 CONSTRAINT fk_airfield_builder FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_vehicle_condition (
 vehicle_lot_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 condition_pct TINYINT UNSIGNED NOT NULL DEFAULT 100,
 last_repaired_at DATETIME NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_fleet_condition_lot FOREIGN KEY(vehicle_lot_id) REFERENCES world_magitek_equipment_inventory(id),
 CONSTRAINT ck_fleet_condition_range CHECK(condition_pct<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_convoy_escorts (
 shipment_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 installation_id BIGINT UNSIGNED NOT NULL,
 troops_committed SMALLINT UNSIGNED NOT NULL,
 status ENUM('assigned','released') NOT NULL DEFAULT 'assigned',
 assigned_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_convoy_escort_shipment FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id),
 CONSTRAINT fk_convoy_escort_installation FOREIGN KEY(installation_id) REFERENCES world_military_installations(id),
 CONSTRAINT fk_convoy_escort_actor FOREIGN KEY(assigned_by) REFERENCES accounts(id),
 CONSTRAINT ck_convoy_escort_troops CHECK(troops_committed BETWEEN 1 AND 10000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_risk_reviews (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 shipment_id BIGINT UNSIGNED NOT NULL,
 risk_type ENUM('weather','ambush','mechanical') NOT NULL,
 proposed_wear TINYINT UNSIGNED NOT NULL DEFAULT 0,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 narrative VARCHAR(500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at DATETIME NULL,
 INDEX ix_risk_shipment(shipment_id,status),
 CONSTRAINT fk_risk_shipment FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id),
 CONSTRAINT fk_risk_proposer FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT fk_risk_reviewer FOREIGN KEY(reviewed_by) REFERENCES accounts(id),
 CONSTRAINT ck_risk_wear CHECK(proposed_wear<=40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('103_airship_ports_escort_readiness') ON DUPLICATE KEY UPDATE version=VALUES(version);
