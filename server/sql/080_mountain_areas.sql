-- Upgrade existing ridge annotations to real, filled impassable mountain areas.
-- Legacy open ridges remain open: no changes to their shape or meaning.
USE eclipse_order;
SET @mountain_closed_exists=(SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_map_mountain_ranges' AND COLUMN_NAME='is_closed');
SET @mountain_closed_sql=IF(@mountain_closed_exists=0,
 'ALTER TABLE world_map_mountain_ranges ADD COLUMN is_closed TINYINT(1) NOT NULL DEFAULT 0',
 'SELECT 1');
PREPARE mountain_closed_stmt FROM @mountain_closed_sql;
EXECUTE mountain_closed_stmt;
DEALLOCATE PREPARE mountain_closed_stmt;
INSERT INTO schema_migrations(version) VALUES('080_mountain_areas')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
