-- Retire factions from the directory without destroying history or world ownership records.
-- Keeping the faction row prevents old seed migrations from reintroducing retired factions.
USE eclipse_order;
SET @archive_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_factions' AND COLUMN_NAME='archived_at');
SET @archive_sql := IF(@archive_col=0,
 'ALTER TABLE order_factions ADD COLUMN archived_at DATETIME NULL DEFAULT NULL',
 'SELECT 1');
PREPARE archive_stmt FROM @archive_sql; EXECUTE archive_stmt; DEALLOCATE PREPARE archive_stmt;
INSERT INTO schema_migrations(version) VALUES('110_faction_archives')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
