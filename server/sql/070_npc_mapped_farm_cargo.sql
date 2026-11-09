-- Mapped NPC agricultural suppliers and real facility-stock cargo transport.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_npc_cargo_routes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 site_id BIGINT UNSIGNED NULL,
 map_settlement_id BIGINT UNSIGNED NULL,
 facility_id BIGINT UNSIGNED NOT NULL,
 travel_hours SMALLINT UNSIGNED NOT NULL DEFAULT 24,
 cargo_capacity DECIMAL(14,3) NOT NULL DEFAULT 30,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_npc_cargo_settlement(settlement_id),
 UNIQUE KEY uq_npc_cargo_site(site_id),
 UNIQUE KEY uq_npc_cargo_map_settlement(map_settlement_id),
 UNIQUE KEY uq_npc_cargo_facility(facility_id),
 KEY ix_npc_cargo_settlement(settlement_id),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(site_id) REFERENCES world_industry_sites(id) ON DELETE RESTRICT,
 FOREIGN KEY(map_settlement_id) REFERENCES world_settlements(id) ON DELETE RESTRICT,
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE RESTRICT,
 CONSTRAINT ck_npc_cargo_source CHECK((site_id IS NULL) <> (map_settlement_id IS NULL)),
 CONSTRAINT ck_npc_cargo_hours CHECK(travel_hours BETWEEN 1 AND 168),
 CONSTRAINT ck_npc_cargo_capacity CHECK(cargo_capacity BETWEEN 1 AND 100000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_npc_cargo_shipments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 route_id BIGINT UNSIGNED NOT NULL,
 settlement_id BIGINT UNSIGNED NOT NULL,
 facility_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(14,3) NOT NULL,
 dispatched_on DATE NOT NULL,
 dispatched_at DATETIME NOT NULL,
 arrival_at DATETIME NOT NULL,
 delivered_at DATETIME NULL,
 status ENUM('in_transit','delivered') NOT NULL DEFAULT 'in_transit',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_npc_cargo_daily_item(route_id,dispatched_on,item_id),
 KEY ix_npc_cargo_arrivals(status,arrival_at),
 FOREIGN KEY(route_id) REFERENCES world_npc_cargo_routes(id) ON DELETE RESTRICT,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE RESTRICT,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT ck_npc_cargo_positive CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_npc_cargo_warehouse (
 settlement_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
 PRIMARY KEY(settlement_id,item_id),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT ck_npc_cargo_stock_positive CHECK(quantity>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- The previous one-time founding feature created hidden settlement-attached farms.
-- Retire their automatic production exactly once without deleting stock or historical cycles.
SET @new_070 := (SELECT IF(COUNT(*)=0,1,0) FROM schema_migrations WHERE version='070_npc_mapped_farm_cargo');
UPDATE world_industry_facilities SET cycle_mode='off'
 WHERE @new_070=1 AND created_by IS NULL AND site_id IS NULL
 AND notes LIKE 'One-time NPC founding farm%';
INSERT INTO schema_migrations(version) VALUES('070_npc_mapped_farm_cargo')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
