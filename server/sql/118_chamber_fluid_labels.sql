-- Admin-configured collection fluid labels, independent of reservoir mechanics.
USE eclipse_order;
SET @eo_118_upper := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber ADD COLUMN upper_fluid_name VARCHAR(80) NOT NULL DEFAULT ''Breast Milk''', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME='upper_fluid_name');
PREPARE eo118a FROM @eo_118_upper; EXECUTE eo118a; DEALLOCATE PREPARE eo118a;
SET @eo_118_lower := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber ADD COLUMN lower_fluid_name VARCHAR(80) NOT NULL DEFAULT ''Secondary Fluid''', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME='lower_fluid_name');
PREPARE eo118b FROM @eo_118_lower; EXECUTE eo118b; DEALLOCATE PREPARE eo118b;
INSERT INTO schema_migrations(version) VALUES('118_chamber_fluid_labels') ON DUPLICATE KEY UPDATE version=VALUES(version);
