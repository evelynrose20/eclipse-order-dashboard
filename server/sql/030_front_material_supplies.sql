-- Daily front provisions consume physical crafted/gathered stock, never gil.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_front_supply_requirements (
 front_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 daily_quantity INT UNSIGNED NOT NULL,
 PRIMARY KEY(front_id,material_id),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT ck_front_supply_qty CHECK(daily_quantity BETWEEN 1 AND 100000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_front_daily_supplies (
 front_id BIGINT UNSIGNED NOT NULL,
 cycle_date DATE NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 required_quantity INT UNSIGNED NOT NULL,
 consumed_quantity INT UNSIGNED NOT NULL,
 missing_quantity INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(front_id,cycle_date,material_id),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- The old daily_supplies numeric field is retained for backwards compatibility,
-- but its gil value is intentionally ignored from this migration forward.
INSERT INTO schema_migrations(version) VALUES('030_front_material_supplies')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
