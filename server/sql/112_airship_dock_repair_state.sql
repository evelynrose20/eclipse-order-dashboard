-- Preserve physical damage separately from administrative closure.
-- Closing a damaged landing dock must never erase its repair requirement.
USE eclipse_order;
SET @has_dock_repair := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_air_docks' AND COLUMN_NAME='repair_required');
SET @dock_repair_sql := IF(@has_dock_repair=0,
 'ALTER TABLE world_logistics_air_docks ADD COLUMN repair_required TINYINT(1) NOT NULL DEFAULT 0',
 'SELECT 1');
PREPARE dock_repair_stmt FROM @dock_repair_sql; EXECUTE dock_repair_stmt; DEALLOCATE PREPARE dock_repair_stmt;
UPDATE world_logistics_air_docks SET repair_required=1 WHERE status='damaged';
INSERT INTO schema_migrations(version) VALUES('112_airship_dock_repair_state')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
