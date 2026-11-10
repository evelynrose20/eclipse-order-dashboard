-- Autonomous NPC food relief uses real settlement reserves and mapped routes, not minted stock.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_npc_trade_shipments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 source_settlement_id BIGINT UNSIGNED NOT NULL,
 destination_settlement_id BIGINT UNSIGNED NOT NULL,
 amount DECIMAL(15,3) NOT NULL,
 origin_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 destination_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 route_json JSON NOT NULL,
 status ENUM('in_transit','delivered','held') NOT NULL DEFAULT 'in_transit',
 departed_on DATE NOT NULL,
 departed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 due_at DATETIME NOT NULL,
 delivered_at DATETIME NULL,
 UNIQUE KEY uq_npc_relief_day(source_settlement_id,destination_settlement_id,departed_on),
 INDEX ix_npc_relief_status(status,due_at),
 FOREIGN KEY(source_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(destination_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(origin_faction_id) REFERENCES order_factions(id),
 FOREIGN KEY(destination_faction_id) REFERENCES order_factions(id),
 CONSTRAINT chk_npc_relief_amount CHECK(amount>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('096_npc_food_relief_routes')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
