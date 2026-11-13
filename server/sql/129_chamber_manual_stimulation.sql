-- Operator-controlled 100-point stimulation meter. No automatic action on reaching the threshold.
-- Resets are limited to the seated player's direct action; existing collection stock is retained.
USE eclipse_order;
SET @eo129a := (SELECT IF(COUNT(*)=0,'ALTER TABLE order_thrall_seat ADD COLUMN stimulation_points DECIMAL(5,2) NOT NULL DEFAULT 0','DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_seat' AND COLUMN_NAME='stimulation_points');
PREPARE eo129a FROM @eo129a; EXECUTE eo129a; DEALLOCATE PREPARE eo129a;
SET @eo129b := (SELECT IF(COUNT(*)=0,'ALTER TABLE order_thrall_seat ADD COLUMN stimulation_last_at DATETIME(3) NULL','DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_seat' AND COLUMN_NAME='stimulation_last_at');
PREPARE eo129b FROM @eo129b; EXECUTE eo129b; DEALLOCATE PREPARE eo129b;
SET @eo129c := (SELECT IF(COUNT(*)=0,"ALTER TABLE order_thrall_chamber ADD COLUMN stimulation_meter_label VARCHAR(64) NOT NULL DEFAULT 'Stimulation'",'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME='stimulation_meter_label');
PREPARE eo129c FROM @eo129c; EXECUTE eo129c; DEALLOCATE PREPARE eo129c;
SET @eo129d := (SELECT IF(COUNT(*)=0,"ALTER TABLE order_thrall_chamber ADD COLUMN stimulation_action_label VARCHAR(64) NOT NULL DEFAULT 'Activate'",'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME='stimulation_action_label');
PREPARE eo129d FROM @eo129d; EXECUTE eo129d; DEALLOCATE PREPARE eo129d;
INSERT INTO schema_migrations(version) VALUES('129_chamber_manual_stimulation') ON DUPLICATE KEY UPDATE version=VALUES(version);
