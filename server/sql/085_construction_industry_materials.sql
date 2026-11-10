-- Re-runnable extension for industrial campaign materials; keep legacy workshop contributions.
USE eclipse_order;
ALTER TABLE order_construction_requirements
 MODIFY COLUMN material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL;
SET @has_industry_item=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_construction_requirements' AND COLUMN_NAME='industry_item_id');
SET @migration_sql=IF(@has_industry_item=0,
 'ALTER TABLE order_construction_requirements ADD COLUMN industry_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL, ADD CONSTRAINT fk_construction_industry_item FOREIGN KEY(industry_item_id) REFERENCES world_industry_items(id), ADD UNIQUE KEY uq_construction_industry_item(stage_id,industry_item_id)',
 'SELECT 1');
PREPARE statement FROM @migration_sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
ALTER TABLE order_construction_contributions
 MODIFY COLUMN source ENUM('reserved','shared','facility') NOT NULL;
SET @has_facility=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_construction_contributions' AND COLUMN_NAME='facility_id');
SET @migration_sql=IF(@has_facility=0,
 'ALTER TABLE order_construction_contributions ADD COLUMN facility_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_construction_delivery_facility FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE SET NULL',
 'SELECT 1');
PREPARE statement FROM @migration_sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
ALTER TABLE world_industry_ledger
 MODIFY COLUMN action ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit','military_supply','freight_dispatch','freight_arrival','freight_refund','freight_fuel','civic_delivery') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('085_construction_industry_materials')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
