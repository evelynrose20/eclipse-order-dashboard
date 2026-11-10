-- Link industry freight to existing assembled internal railway journeys, preserving old manifests.
USE eclipse_order;
SET @has_rail_freight=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_shipments' AND COLUMN_NAME='train_journey_id');
SET @rail_sql=IF(@has_rail_freight=0,
 'ALTER TABLE world_logistics_shipments ADD COLUMN train_journey_id BIGINT UNSIGNED NULL, ADD INDEX ix_freight_train_journey(train_journey_id), ADD CONSTRAINT fk_freight_train_journey FOREIGN KEY(train_journey_id) REFERENCES order_internal_rail_journeys(id) ON DELETE RESTRICT',
 'SELECT 1');
PREPARE statement FROM @rail_sql; EXECUTE statement; DEALLOCATE PREPARE statement;
INSERT INTO schema_migrations(version) VALUES('097_rail_freight_journeys')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
