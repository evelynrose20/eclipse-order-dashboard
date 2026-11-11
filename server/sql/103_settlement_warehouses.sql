-- Capital and settlement warehouses. Separate accountable inventories; no implicit stock.
-- Cargo is debited from a real industry facility on dispatch and credited at arrival.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_warehouses (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(130) NOT NULL,
 tier ENUM('depot','storehouse','grand') NOT NULL DEFAULT 'depot',
 capacity_units INT UNSIGNED NOT NULL,
 state ENUM('planned','operational','damaged','closed') NOT NULL DEFAULT 'planned',
 construction_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 construction_quantity DECIMAL(15,3) NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 commissioned_at DATETIME NULL,
 UNIQUE KEY uq_warehouse_settlement_name(settlement_id,name),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(construction_item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT ck_warehouse_size CHECK(capacity_units BETWEEN 100 AND 100000),
 CONSTRAINT ck_warehouse_material CHECK(construction_quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_warehouse_stock (
 warehouse_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
 PRIMARY KEY(warehouse_id,item_id),
 FOREIGN KEY(warehouse_id) REFERENCES world_logistics_warehouses(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT ck_warehouse_stock CHECK(quantity>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_warehouse_shipments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 source_facility_id BIGINT UNSIGNED NOT NULL,
 destination_warehouse_id BIGINT UNSIGNED NOT NULL,
 transport_template_id BIGINT UNSIGNED NOT NULL,
 vehicle_lot_id BIGINT UNSIGNED NULL,
 train_journey_id BIGINT UNSIGNED NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 fuel_used DECIMAL(15,3) NOT NULL DEFAULT 0,
 route_segments JSON NOT NULL,
 status ENUM('in_transit','arrived','disrupted','cancelled') NOT NULL DEFAULT 'in_transit',
 due_at DATETIME NOT NULL,
 departed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 arrived_at DATETIME NULL,
 incident_notes VARCHAR(300) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 INDEX ix_warehouse_shipments_due(status,due_at),
 FOREIGN KEY(source_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY(destination_warehouse_id) REFERENCES world_logistics_warehouses(id),
 FOREIGN KEY(transport_template_id) REFERENCES world_logistics_transport_templates(id),
 FOREIGN KEY(vehicle_lot_id) REFERENCES world_magitek_equipment_inventory(id),
 FOREIGN KEY(train_journey_id) REFERENCES order_internal_rail_journeys(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT ck_warehouse_shipment_quantity CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_warehouse_ledger (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 warehouse_id BIGINT UNSIGNED NOT NULL,
 shipment_id BIGINT UNSIGNED NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 delta DECIMAL(15,3) NOT NULL,
 balance_after DECIMAL(15,3) NOT NULL,
 action ENUM('arrival','withdrawal') NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_warehouse_shipment_arrival(shipment_id),
 FOREIGN KEY(warehouse_id) REFERENCES world_logistics_warehouses(id),
 FOREIGN KEY(shipment_id) REFERENCES world_logistics_warehouse_shipments(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('103_settlement_warehouses')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
