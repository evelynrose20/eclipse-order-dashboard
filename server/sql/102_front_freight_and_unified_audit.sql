-- Authorized private front freight and shared movement audit.
-- No conversion between FC materials and industrial item IDs. No automatic item creation.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_front_hubs (
 front_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 assigned_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_front_hub_front FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 CONSTRAINT fk_front_hub_settlement FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 CONSTRAINT fk_front_hub_actor FOREIGN KEY(assigned_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_front_cargo (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 source_front_id BIGINT UNSIGNED NOT NULL,
 destination_front_id BIGINT UNSIGNED NOT NULL,
 source_settlement_id BIGINT UNSIGNED NULL,
 destination_settlement_id BIGINT UNSIGNED NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 mode ENUM('road','rail','air') NOT NULL,
 status ENUM('requested','approved','in_transit','held','arrived','cancelled') NOT NULL DEFAULT 'requested',
 transport_template_id BIGINT UNSIGNED NULL,
 vehicle_lot_id BIGINT UNSIGNED NULL,
 train_journey_id BIGINT UNSIGNED NULL,
 fuel_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 fuel_used DECIMAL(15,3) NOT NULL DEFAULT 0,
 due_at DATETIME NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 authorized_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 dispatched_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME NULL,
 CONSTRAINT fk_front_cargo_source FOREIGN KEY(source_front_id) REFERENCES order_fronts(id),
 CONSTRAINT fk_front_cargo_destination FOREIGN KEY(destination_front_id) REFERENCES order_fronts(id),
 CONSTRAINT fk_front_cargo_material FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT fk_front_cargo_template FOREIGN KEY(transport_template_id) REFERENCES world_logistics_transport_templates(id),
 CONSTRAINT fk_front_cargo_vehicle FOREIGN KEY(vehicle_lot_id) REFERENCES world_magitek_equipment_inventory(id),
 CONSTRAINT fk_front_cargo_train FOREIGN KEY(train_journey_id) REFERENCES order_internal_rail_journeys(id),
 CONSTRAINT fk_front_cargo_creator FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT fk_front_cargo_authorizer FOREIGN KEY(authorized_by) REFERENCES accounts(id),
 CONSTRAINT fk_front_cargo_dispatcher FOREIGN KEY(dispatched_by) REFERENCES accounts(id),
 INDEX ix_front_cargo_status(status,due_at),
 CONSTRAINT ck_front_cargo_quantity CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_movement_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 receipt_key VARCHAR(110) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 movement_system ENUM('industry','front','npc') NOT NULL,
 reference_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action ENUM('dispatch','arrival','cancel','hold','release','stage','unstage') NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 source_id VARCHAR(90) NOT NULL,
 destination_id VARCHAR(90) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_movement_system(movement_system,reference_id),
 CONSTRAINT ck_movement_qty CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('102_front_freight_and_unified_audit') ON DUPLICATE KEY UPDATE version=VALUES(version);
