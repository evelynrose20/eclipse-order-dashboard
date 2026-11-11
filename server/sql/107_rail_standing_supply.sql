-- Rail freight uses actual assembled trains and station services, never a drawn line alone.
USE eclipse_order;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_supply_lines' AND COLUMN_NAME='train_consist_id');
SET @stmt=IF(@has=0,'ALTER TABLE world_logistics_supply_lines ADD COLUMN train_consist_id BIGINT UNSIGNED NULL, ADD COLUMN rail_route_id BIGINT UNSIGNED NULL','SELECT 1');
PREPARE q FROM @stmt;EXECUTE q;DEALLOCATE PREPARE q;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_supply_line_shipments' AND COLUMN_NAME='train_consist_id');
SET @stmt=IF(@has=0,'ALTER TABLE world_logistics_supply_line_shipments ADD COLUMN train_consist_id BIGINT UNSIGNED NULL, ADD COLUMN rail_journey_id BIGINT UNSIGNED NULL, ADD COLUMN return_journey_id BIGINT UNSIGNED NULL, ADD COLUMN return_due_at DATETIME NULL','SELECT 1');
PREPARE q FROM @stmt;EXECUTE q;DEALLOCATE PREPARE q;
INSERT INTO schema_migrations(version) VALUES('107_rail_standing_supply')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
