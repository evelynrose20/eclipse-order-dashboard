-- Repeatable maintenance projects for weather-damaged equipment.
USE eclipse_order;
SET @industry_repair_col := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_projects ADD COLUMN equipment_repair TINYINT(1) NOT NULL DEFAULT 0',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_industry_projects' AND column_name='equipment_repair');
PREPARE weather_repair_stmt FROM @industry_repair_col;
EXECUTE weather_repair_stmt;
DEALLOCATE PREPARE weather_repair_stmt;
INSERT INTO schema_migrations(version) VALUES('061_industry_equipment_maintenance') ON DUPLICATE KEY UPDATE version=VALUES(version);
