-- Freight service plans must originate from actual commissioned fleet or an assembled train.
-- Existing historic service definitions remain valid; new registration is inventory-backed.
USE eclipse_order;
SET @has_lot=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_transport_templates' AND COLUMN_NAME='source_equipment_lot_id');
SET @statement=IF(@has_lot=0,'ALTER TABLE world_logistics_transport_templates ADD COLUMN source_equipment_lot_id BIGINT UNSIGNED NULL, ADD UNIQUE KEY uq_logistics_equipment_lot(source_equipment_lot_id), ADD CONSTRAINT fk_logistics_equipment_lot FOREIGN KEY(source_equipment_lot_id) REFERENCES world_magitek_equipment_inventory(id)','SELECT 1');
PREPARE s FROM @statement; EXECUTE s; DEALLOCATE PREPARE s;
SET @has_train=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_transport_templates' AND COLUMN_NAME='source_train_consist_id');
SET @statement=IF(@has_train=0,'ALTER TABLE world_logistics_transport_templates ADD COLUMN source_train_consist_id BIGINT UNSIGNED NULL, ADD UNIQUE KEY uq_logistics_train_consist(source_train_consist_id), ADD CONSTRAINT fk_logistics_train_consist FOREIGN KEY(source_train_consist_id) REFERENCES world_magitek_train_consists(id)','SELECT 1');
PREPARE s FROM @statement; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO schema_migrations(version) VALUES('099_inventory_backed_transport') ON DUPLICATE KEY UPDATE version=VALUES(version);
