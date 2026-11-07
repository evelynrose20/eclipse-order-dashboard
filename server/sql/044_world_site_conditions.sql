-- Separate territorial condition from faction control; preserve existing states and routes.
USE eclipse_order;
SET @status_col := (
 SELECT COLUMN_TYPE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_settlements' AND COLUMN_NAME='strategic_state'
);
SET @status_ddl := IF(
 @status_col LIKE '%''destroyed''%',
 'SELECT 1',
 "ALTER TABLE world_settlements MODIFY strategic_state ENUM('peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed') NOT NULL DEFAULT 'peaceful'"
);
PREPARE status_stmt FROM @status_ddl;
EXECUTE status_stmt;
DEALLOCATE PREPARE status_stmt;

INSERT INTO schema_migrations(version) VALUES('044_world_site_conditions')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
