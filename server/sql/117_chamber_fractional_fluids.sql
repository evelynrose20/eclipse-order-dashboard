-- Preserve fractional chamber fluid volumes and daily use across restarts.
-- Existing integer amounts migrate without loss.
USE eclipse_order;
ALTER TABLE order_thrall_chamber
 MODIFY upper_volume DECIMAL(10,1) UNSIGNED NOT NULL DEFAULT 0.0,
 MODIFY lower_volume DECIMAL(10,1) UNSIGNED NOT NULL DEFAULT 0.0;
ALTER TABLE order_thrall_seat
 MODIFY upper_recorded DECIMAL(10,1) UNSIGNED NOT NULL DEFAULT 0.0,
 MODIFY lower_recorded DECIMAL(10,1) UNSIGNED NOT NULL DEFAULT 0.0;
ALTER TABLE order_thrall_daily_output
 MODIFY upper_used DECIMAL(10,1) UNSIGNED NOT NULL DEFAULT 0.0,
 MODIFY lower_used DECIMAL(10,1) UNSIGNED NOT NULL DEFAULT 0.0;
ALTER TABLE order_thrall_chamber_batches
 MODIFY quantity DECIMAL(10,1) UNSIGNED NOT NULL;
INSERT INTO schema_migrations(version) VALUES('117_chamber_fractional_fluids') ON DUPLICATE KEY UPDATE version=VALUES(version);
