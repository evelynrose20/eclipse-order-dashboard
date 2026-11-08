-- Optional character identity/anatomy and distinct lower collection classifications.
-- Does not infer sex characteristics from gender and preserves existing records.
USE eclipse_order;
SET @eo_063_0 := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_contribution_preferences ADD COLUMN gender_identity VARCHAR(32) NOT NULL DEFAULT 'unspecified'', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_contribution_preferences' AND COLUMN_NAME='gender_identity');
PREPARE eo_063_stmt_0 FROM @eo_063_0; EXECUTE eo_063_stmt_0; DEALLOCATE PREPARE eo_063_stmt_0;
SET @eo_063_1 := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_contribution_preferences ADD COLUMN lower_anatomy VARCHAR(32) NOT NULL DEFAULT 'unspecified'', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_contribution_preferences' AND COLUMN_NAME='lower_anatomy');
PREPARE eo_063_stmt_1 FROM @eo_063_1; EXECUTE eo_063_stmt_1; DEALLOCATE PREPARE eo_063_stmt_1;
SET @eo_063_2 := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber ADD COLUMN lower_material_type VARCHAR(32) NOT NULL DEFAULT 'unclassified'', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME='lower_material_type');
PREPARE eo_063_stmt_2 FROM @eo_063_2; EXECUTE eo_063_stmt_2; DEALLOCATE PREPARE eo_063_stmt_2;
SET @eo_063_3 := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber_batches ADD COLUMN material_type VARCHAR(32) NOT NULL DEFAULT 'unclassified'', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber_batches' AND COLUMN_NAME='material_type');
PREPARE eo_063_stmt_3 FROM @eo_063_3; EXECUTE eo_063_stmt_3; DEALLOCATE PREPARE eo_063_stmt_3;
INSERT INTO schema_migrations(version) VALUES('063_chamber_character_profiles') ON DUPLICATE KEY UPDATE version=VALUES(version);
