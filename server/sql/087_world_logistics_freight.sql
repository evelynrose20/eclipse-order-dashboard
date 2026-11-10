-- P4 freight: additive stateful consignments and recurring shipping agreements.
-- No transfer touches member inventory, front reservations or civilian stores.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_transport_templates (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 mode ENUM('road','rail','air','sea','pack') NOT NULL,
 capacity DECIMAL(15,3) NOT NULL,
 minutes_per_leg SMALLINT UNSIGNED NOT NULL DEFAULT 60,
 fuel_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 fuel_per_leg DECIMAL(12,3) NOT NULL DEFAULT 0,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(fuel_item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_transport_capacity CHECK(capacity>0 AND capacity<=100000),
 CONSTRAINT chk_transport_fuel CHECK(fuel_per_leg>=0 AND fuel_per_leg<=100000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_contracts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 purpose ENUM('trade','relief','military','industry') NOT NULL DEFAULT 'trade',
 source_facility_id BIGINT UNSIGNED NOT NULL,
 destination_facility_id BIGINT UNSIGNED NOT NULL,
 transport_template_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 cadence_days SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('active','paused','retired') NOT NULL DEFAULT 'active',
 last_dispatched_at DATETIME NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(source_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY(destination_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY(transport_template_id) REFERENCES world_logistics_transport_templates(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_contract_qty CHECK(quantity>0 AND quantity<=1000000),
 CONSTRAINT chk_contract_cadence CHECK(cadence_days BETWEEN 1 AND 365)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_shipments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 contract_id BIGINT UNSIGNED NULL,
 source_facility_id BIGINT UNSIGNED NOT NULL,
 destination_facility_id BIGINT UNSIGNED NOT NULL,
 transport_template_id BIGINT UNSIGNED NOT NULL,
 vehicle_lot_id BIGINT UNSIGNED NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 fuel_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 fuel_used DECIMAL(15,3) NOT NULL DEFAULT 0,
 route_segments JSON NOT NULL,
 route_nodes JSON NOT NULL,
 mode ENUM('road','rail','air','sea','pack') NOT NULL,
 status ENUM('in_transit','arrived','cancelled','disrupted') NOT NULL DEFAULT 'in_transit',
 departed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 due_at DATETIME NOT NULL,
 arrived_at DATETIME NULL,
 escort_notes VARCHAR(300) NOT NULL DEFAULT '',
 incident_notes VARCHAR(500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 FOREIGN KEY(contract_id) REFERENCES world_logistics_contracts(id) ON DELETE SET NULL,
 FOREIGN KEY(source_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY(destination_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY(transport_template_id) REFERENCES world_logistics_transport_templates(id),
 FOREIGN KEY(vehicle_lot_id) REFERENCES world_magitek_equipment_inventory(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(fuel_item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_logistics_status(status,due_at),
 INDEX ix_logistics_contract(contract_id,id),
 CONSTRAINT chk_shipment_qty CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 shipment_id BIGINT UNSIGNED NOT NULL,
 action ENUM('dispatch','arrival','cancel','disrupt','resume') NOT NULL,
 note VARCHAR(500) NOT NULL DEFAULT '',
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 INDEX ix_logistics_event(shipment_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE world_industry_ledger MODIFY COLUMN action
 ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit','military_supply','freight_dispatch','freight_arrival','freight_refund','freight_fuel','civic_delivery','corridor_build') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('087_world_logistics_freight')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
