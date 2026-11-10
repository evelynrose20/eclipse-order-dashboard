-- Garlean airship landing installations. Routes require operational docks at both ends.
-- Commissioning consumes materials from a real facility at the settlement.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_air_docks (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL,
 status ENUM('planned','operational','damaged','closed') NOT NULL DEFAULT 'planned',
 material_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_quantity DECIMAL(15,3) NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 commissioned_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(material_item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_air_dock_material_qty CHECK(material_quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('102_airship_landing_facilities')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
