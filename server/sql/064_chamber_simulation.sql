-- Automated fictional chamber cycle bookkeeping, safe to rerun.
USE eclipse_order;
SET @eo_064_a := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_seat ADD COLUMN upper_last_cycle_at DATETIME(3) NULL', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_seat' AND COLUMN_NAME='upper_last_cycle_at');
PREPARE eo064a FROM @eo_064_a; EXECUTE eo064a; DEALLOCATE PREPARE eo064a;
SET @eo_064_b := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_seat ADD COLUMN lower_last_cycle_at DATETIME(3) NULL', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_seat' AND COLUMN_NAME='lower_last_cycle_at');
PREPARE eo064b FROM @eo_064_b; EXECUTE eo064b; DEALLOCATE PREPARE eo064b;
SET @eo_064_c := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_contribution_preferences ADD COLUMN lactation_state VARCHAR(24) NOT NULL DEFAULT ''none''', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_contribution_preferences' AND COLUMN_NAME='lactation_state');
PREPARE eo064c FROM @eo_064_c; EXECUTE eo064c; DEALLOCATE PREPARE eo064c;
INSERT INTO schema_migrations(version) VALUES('064_chamber_simulation') ON DUPLICATE KEY UPDATE version=VALUES(version);
