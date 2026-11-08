-- Settlement structures are independent of map icons, roads and rail systems.
USE eclipse_order;
ALTER TABLE world_settlements ADD COLUMN housing_capacity INT UNSIGNED NOT NULL DEFAULT 0;
-- Existing populations retain enough legacy accommodation to prevent destructive migrations.
UPDATE world_settlements SET housing_capacity=population WHERE housing_capacity<population;
CREATE TABLE IF NOT EXISTS world_settlement_upgrades (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL,
 category ENUM('housing','defense','clinic','water','food_storage','insulation','public_works') NOT NULL,
 status ENUM('planned','building','operational','damaged','destroyed') NOT NULL DEFAULT 'planned',
 condition_pct TINYINT UNSIGNED NOT NULL DEFAULT 100,
 level TINYINT UNSIGNED NOT NULL DEFAULT 1,
 housing_bonus INT UNSIGNED NOT NULL DEFAULT 0,
 service_bonus TINYINT UNSIGNED NOT NULL DEFAULT 0,
 defense_bonus TINYINT UNSIGNED NOT NULL DEFAULT 0,
 notes VARCHAR(500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_world_upgrade_site(settlement_id,status),
 CONSTRAINT chk_world_upgrade_condition CHECK(condition_pct<=100),
 CONSTRAINT chk_world_upgrade_level CHECK(level BETWEEN 1 AND 20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('052_settlement_upgrades') ON DUPLICATE KEY UPDATE version=VALUES(version);
