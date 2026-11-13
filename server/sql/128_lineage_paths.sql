-- Dedicated fictional voidsent lineage tracking. Existing cases remain standard research.
-- No pregnancy records, consent flags, character ownership, or reproductive outcomes are changed.
USE eclipse_order;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN lineage_type ENUM(''standard'',''voidsent'') NOT NULL DEFAULT ''standard''',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='lineage_type');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN subject_role ENUM(''source'',''carrier'',''descendant'') NOT NULL DEFAULT ''carrier''',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='subject_role');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN expression_stage ENUM(''none'',''subtle'',''developing'',''stable'') NOT NULL DEFAULT ''none''',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='expression_stage');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN traits JSON NULL',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='traits');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN participant_note VARCHAR(1200) NOT NULL DEFAULT ''''',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='participant_note');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN void_revealed TINYINT(1) NOT NULL DEFAULT 0',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='void_revealed');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN offspring_stage ENUM(''not_recorded'',''anticipated'',''documented'') NOT NULL DEFAULT ''not_recorded''',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='offspring_stage');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN offspring_traits JSON NULL',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='offspring_traits');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
SET @l128=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_lineage_cases ADD COLUMN parenthood_note VARCHAR(1200) NOT NULL DEFAULT ''''',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_lineage_cases' AND COLUMN_NAME='parenthood_note');
PREPARE s128 FROM @l128; EXECUTE s128; DEALLOCATE PREPARE s128;
INSERT INTO schema_migrations(version) VALUES('128_lineage_paths') ON DUPLICATE KEY UPDATE version=VALUES(version);
