-- Fictional magitek rolling stock, transport and armament manufacturing.
-- All equipment must be produced through the ordinary industry recipe/stock engine.
USE eclipse_order;
ALTER TABLE world_industry_items MODIFY COLUMN category
 ENUM('raw','refined','fuel','supply','byproduct','equipment') NOT NULL DEFAULT 'raw';
CREATE TABLE IF NOT EXISTS world_magitek_equipment_templates (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 equipment_kind ENUM('transport','locomotive','railcar','armored_vehicle','airship','field_equipment','siege_equipment','other') NOT NULL,
 name VARCHAR(120) NOT NULL,
 description VARCHAR(500) NOT NULL DEFAULT '',
 transport_capacity INT UNSIGNED NOT NULL DEFAULT 0,
 cargo_capacity INT UNSIGNED NOT NULL DEFAULT 0,
 crew_required SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 fuel_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 fuel_per_operation DECIMAL(12,3) NOT NULL DEFAULT 0,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(fuel_item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id) ON DELETE SET NULL,
 CONSTRAINT chk_magitek_capacity CHECK(transport_capacity<=10000 AND cargo_capacity<=100000 AND crew_required<=1000 AND fuel_per_operation>=0 AND fuel_per_operation<=10000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_magitek_equipment_inventory (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 equipment_template_id BIGINT UNSIGNED NOT NULL,
 origin_facility_id BIGINT UNSIGNED NOT NULL,
 owner_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 stationed_settlement_id BIGINT UNSIGNED NULL,
 quantity INT UNSIGNED NOT NULL,
 status ENUM('reserve','assigned','damaged','retired') NOT NULL DEFAULT 'reserve',
 notes VARCHAR(300) NOT NULL DEFAULT '',
 registered_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(equipment_template_id) REFERENCES world_magitek_equipment_templates(id),
 FOREIGN KEY(origin_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY(owner_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(stationed_settlement_id) REFERENCES world_settlements(id) ON DELETE SET NULL,
 FOREIGN KEY(registered_by) REFERENCES accounts(id),
 CONSTRAINT chk_magitek_quantity CHECK(quantity BETWEEN 1 AND 100000),
 INDEX ix_magitek_equipment_owner(owner_faction_id,status),
 INDEX ix_magitek_equipment_origin(origin_facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_magitek_equipment_movements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 inventory_id BIGINT UNSIGNED NOT NULL,
 action ENUM('commission','assign','reserve','damage','retire') NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 detail VARCHAR(300) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(inventory_id) REFERENCES world_magitek_equipment_inventory(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 INDEX ix_magitek_movements_inventory(inventory_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('071_magitek_equipment_manufacturing')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
