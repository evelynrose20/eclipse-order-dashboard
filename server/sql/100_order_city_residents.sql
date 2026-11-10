-- Order city builder residential intake. Entirely separate from NPC autonomous economy.
-- All settlements remain OFF until staff explicitly opts in; no records are seeded.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_order_city_policies (
 settlement_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 residential_intake ENUM('off','automatic') NOT NULL DEFAULT 'off',
 last_intake_date DATE NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_order_city_policy_settlement FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_order_city_arrivals (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 cycle_date DATE NOT NULL,
 residents_before INT UNSIGNED NOT NULL,
 residents_arrived INT UNSIGNED NOT NULL,
 residents_after INT UNSIGNED NOT NULL,
 housing_capacity INT UNSIGNED NOT NULL,
 food_stock DECIMAL(16,3) NOT NULL,
 water_stock DECIMAL(16,3) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_order_city_arrival_day(settlement_id,cycle_date),
 CONSTRAINT fk_order_city_arrival_settlement FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('100_order_city_residents') ON DUPLICATE KEY UPDATE version=VALUES(version);
