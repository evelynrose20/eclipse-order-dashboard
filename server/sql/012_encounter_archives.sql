-- Archived scenes remain recoverable and keep all linked encounter history.
USE eclipse_order;
SET @already := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_encounters' AND COLUMN_NAME='archived_at');
SET @sql := IF(@already=0,'ALTER TABLE order_encounters ADD COLUMN archived_at DATETIME NULL',"SELECT 'archived_at already exists' AS status");
PREPARE archive_migration FROM @sql;
EXECUTE archive_migration;
DEALLOCATE PREPARE archive_migration;
INSERT INTO schema_migrations(version) VALUES('012_encounter_archives') ON DUPLICATE KEY UPDATE version=VALUES(version);
