-- Add the story board's difficulty, impact and serialized chapters.
-- Idempotent and preserves every existing event.
USE eclipse_order;
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_encounters' AND COLUMN_NAME='event_story');
SET @stmt_sql := IF(@has_col=0,'ALTER TABLE order_encounters ADD COLUMN event_story JSON NULL',"SELECT 'event_story already exists' AS status");
PREPARE migration_stmt FROM @stmt_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
INSERT INTO schema_migrations(version) VALUES('011_event_story') ON DUPLICATE KEY UPDATE version=VALUES(version);
