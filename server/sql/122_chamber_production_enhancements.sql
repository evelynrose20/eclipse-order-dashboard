-- Optional staff-managed production enhancements. Existing profiles remain at tier 0.
USE eclipse_order;
SET @eo_122_upper := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_contribution_preferences ADD COLUMN upper_enhancement TINYINT UNSIGNED NOT NULL DEFAULT 0', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_contribution_preferences' AND COLUMN_NAME='upper_enhancement');
PREPARE eo122upper FROM @eo_122_upper; EXECUTE eo122upper; DEALLOCATE PREPARE eo122upper;
SET @eo_122_lower := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_contribution_preferences ADD COLUMN lower_enhancement TINYINT UNSIGNED NOT NULL DEFAULT 0', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_contribution_preferences' AND COLUMN_NAME='lower_enhancement');
PREPARE eo122lower FROM @eo_122_lower; EXECUTE eo122lower; DEALLOCATE PREPARE eo122lower;
INSERT INTO schema_migrations(version) VALUES('122_chamber_production_enhancements') ON DUPLICATE KEY UPDATE version=VALUES(version);
