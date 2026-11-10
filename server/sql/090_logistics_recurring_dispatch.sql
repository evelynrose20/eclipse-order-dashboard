-- Explicitly opt-in recurring freight; disabled by default and tied to a real commissioned lot.
USE eclipse_order;
SET @has_freight_auto=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_contracts' AND COLUMN_NAME='auto_dispatch');
SET @sql=IF(@has_freight_auto=0,
 'ALTER TABLE world_logistics_contracts ADD COLUMN auto_dispatch TINYINT(1) NOT NULL DEFAULT 0',
 'SELECT 1');
PREPARE m FROM @sql; EXECUTE m; DEALLOCATE PREPARE m;
SET @has_freight_vehicle=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_contracts' AND COLUMN_NAME='preferred_vehicle_lot_id');
SET @sql=IF(@has_freight_vehicle=0,
 'ALTER TABLE world_logistics_contracts ADD COLUMN preferred_vehicle_lot_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_logistics_contract_vehicle FOREIGN KEY(preferred_vehicle_lot_id) REFERENCES world_magitek_equipment_inventory(id) ON DELETE SET NULL',
 'SELECT 1');
PREPARE m FROM @sql; EXECUTE m; DEALLOCATE PREPARE m;
INSERT INTO schema_migrations(version) VALUES('090_logistics_recurring_dispatch')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
