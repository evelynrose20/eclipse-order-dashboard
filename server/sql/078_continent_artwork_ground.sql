-- Select whether command-staff-uploaded cartography is a temporary
-- tracing guide or the actual visual terrain beneath the strategy map.
-- Existing artwork remains a reference until explicitly promoted.
USE eclipse_order;
SET @exists_ref_ground=(SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_continent_reference' AND COLUMN_NAME='use_as_ground');
SET @alter_ref_ground=IF(@exists_ref_ground=0,
 'ALTER TABLE world_continent_reference ADD COLUMN use_as_ground TINYINT(1) NOT NULL DEFAULT 0',
 'SELECT 1');
PREPARE ref_ground_stmt FROM @alter_ref_ground;
EXECUTE ref_ground_stmt;
DEALLOCATE PREPARE ref_ground_stmt;
INSERT INTO schema_migrations(version) VALUES('078_continent_artwork_ground')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
