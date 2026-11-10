-- Resolve blocked NPC relief without inventing food; preserve the original destination.
USE eclipse_order;
ALTER TABLE world_npc_trade_shipments MODIFY COLUMN status ENUM('in_transit','delivered','held','returned') NOT NULL DEFAULT 'in_transit';
SET @npc_hold=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_npc_trade_shipments' AND COLUMN_NAME='held_at');
SET @npc_sql=IF(@npc_hold=0,'ALTER TABLE world_npc_trade_shipments ADD COLUMN held_at DATETIME NULL','SELECT 1');
PREPARE statement FROM @npc_sql; EXECUTE statement; DEALLOCATE PREPARE statement;
SET @npc_reroutes=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_npc_trade_shipments' AND COLUMN_NAME='reroute_count');
SET @npc_sql=IF(@npc_reroutes=0,'ALTER TABLE world_npc_trade_shipments ADD COLUMN reroute_count TINYINT UNSIGNED NOT NULL DEFAULT 0, ADD COLUMN original_destination_settlement_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_npc_original_destination FOREIGN KEY(original_destination_settlement_id) REFERENCES world_settlements(id)','SELECT 1');
PREPARE statement FROM @npc_sql; EXECUTE statement; DEALLOCATE PREPARE statement;
UPDATE world_npc_trade_shipments SET held_at=UTC_TIMESTAMP() WHERE status='held' AND held_at IS NULL;
CREATE TABLE IF NOT EXISTS world_npc_trade_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 shipment_id BIGINT UNSIGNED NOT NULL,
 action ENUM('hold','redirect','return') NOT NULL,
 notes VARCHAR(300) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(shipment_id) REFERENCES world_npc_trade_shipments(id),
 INDEX ix_npc_trade_events(shipment_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('098_npc_relief_recovery')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
