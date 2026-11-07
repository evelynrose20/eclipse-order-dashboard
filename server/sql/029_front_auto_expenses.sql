-- Automatically funded front operating costs; no member/character payments.
USE eclipse_order;
SET @has_front_rent := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_fronts' AND COLUMN_NAME='daily_rent');
SET @front_rent_sql := IF(@has_front_rent=0,'ALTER TABLE order_fronts ADD COLUMN daily_rent INT UNSIGNED NOT NULL DEFAULT 2','SELECT 1');
PREPARE stmt FROM @front_rent_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_front_supplies := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_fronts' AND COLUMN_NAME='daily_supplies');
SET @front_supplies_sql := IF(@has_front_supplies=0,'ALTER TABLE order_fronts ADD COLUMN daily_supplies INT UNSIGNED NOT NULL DEFAULT 1','SELECT 1');
PREPARE stmt FROM @front_supplies_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_front_upkeep := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_fronts' AND COLUMN_NAME='daily_upkeep');
SET @front_upkeep_sql := IF(@has_front_upkeep=0,'ALTER TABLE order_fronts ADD COLUMN daily_upkeep INT UNSIGNED NOT NULL DEFAULT 1','SELECT 1');
PREPARE stmt FROM @front_upkeep_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS order_front_daily_expenses (
 front_id BIGINT UNSIGNED NOT NULL,
 cycle_date DATE NOT NULL,
 scheduled_total INT UNSIGNED NOT NULL,
 paid_total INT UNSIGNED NOT NULL,
 shortfall INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(front_id,cycle_date),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('029_front_auto_expenses')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
