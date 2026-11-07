-- Add a durable UTC growth clock to existing plots without resetting crops or stock.
USE eclipse_order;
SET @has_garden_clock := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_garden_plots' AND COLUMN_NAME='last_growth_at');
SET @garden_clock_ddl := IF(@has_garden_clock=0,'ALTER TABLE fc_garden_plots ADD COLUMN last_growth_at DATETIME NULL','SELECT 1');
PREPARE garden_clock_stmt FROM @garden_clock_ddl;
EXECUTE garden_clock_stmt;
DEALLOCATE PREPARE garden_clock_stmt;
UPDATE fc_garden_plots SET last_growth_at=UTC_TIMESTAMP() WHERE last_growth_at IS NULL;
ALTER TABLE fc_garden_plots MODIFY COLUMN last_growth_at DATETIME NOT NULL;
INSERT INTO schema_migrations(version) VALUES('035_garden_growth_clock') ON DUPLICATE KEY UPDATE version=VALUES(version);
