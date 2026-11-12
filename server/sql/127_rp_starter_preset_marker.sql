-- One-time RP starter suggestions: remember when a member saves a reviewed list.
-- Existing private entries and sharing choices remain untouched.
USE eclipse_order;
SET @rp127=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_member_rp_profiles ADD COLUMN starter_seeds_applied TINYINT(1) NOT NULL DEFAULT 0',
 'DO 0')
 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='order_member_rp_profiles' AND COLUMN_NAME='starter_seeds_applied');
PREPARE rp127 FROM @rp127;
EXECUTE rp127;
DEALLOCATE PREPARE rp127;
INSERT INTO schema_migrations(version) VALUES('127_rp_starter_preset_marker')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
