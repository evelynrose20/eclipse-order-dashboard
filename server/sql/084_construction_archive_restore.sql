-- Preserve project lifecycle across archival without changing existing projects.
-- Pre-migration archived projects have NULL prior state and are inferred from
-- their saved construction stages when restored.
USE eclipse_order;
SET @construction_archive_column_exists=(
 SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_construction_projects'
 AND COLUMN_NAME='pre_archive_state'
);
SET @construction_archive_column_sql=IF(@construction_archive_column_exists=0,
 'ALTER TABLE order_construction_projects ADD COLUMN pre_archive_state ENUM(''draft'',''open'',''paused'',''completed'') NULL DEFAULT NULL',
 'SELECT 1');
PREPARE construction_archive_stmt FROM @construction_archive_column_sql;
EXECUTE construction_archive_stmt;
DEALLOCATE PREPARE construction_archive_stmt;
INSERT INTO schema_migrations(version) VALUES('084_construction_archive_restore')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
