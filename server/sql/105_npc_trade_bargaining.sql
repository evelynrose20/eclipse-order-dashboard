-- Staff-approved NPC food bargaining backed by real settlement stores.
-- Quotes are recorded terms; no fictitious gil wallet or unbacked payments are created.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_npc_bargains (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 seller_settlement_id BIGINT UNSIGNED NOT NULL,
 buyer_settlement_id BIGINT UNSIGNED NOT NULL,
 origin_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 destination_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 quote_per_unit INT UNSIGNED NOT NULL,
 offer_per_unit INT UNSIGNED NOT NULL,
 status ENUM('proposed','countered','accepted','rejected') NOT NULL DEFAULT 'proposed',
 shipment_id BIGINT UNSIGNED NULL UNIQUE,
 requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 resolved_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 decided_at DATETIME NULL,
 CONSTRAINT fk_npc_bargain_seller FOREIGN KEY(seller_settlement_id) REFERENCES world_settlements(id),
 CONSTRAINT fk_npc_bargain_buyer FOREIGN KEY(buyer_settlement_id) REFERENCES world_settlements(id),
 CONSTRAINT fk_npc_bargain_faction_a FOREIGN KEY(origin_faction_id) REFERENCES order_factions(id),
 CONSTRAINT fk_npc_bargain_faction_b FOREIGN KEY(destination_faction_id) REFERENCES order_factions(id),
 CONSTRAINT fk_npc_bargain_shipment FOREIGN KEY(shipment_id) REFERENCES world_npc_trade_shipments(id),
 CONSTRAINT fk_npc_bargain_requester FOREIGN KEY(requested_by) REFERENCES accounts(id),
 CONSTRAINT fk_npc_bargain_reviewer FOREIGN KEY(resolved_by) REFERENCES accounts(id),
 CONSTRAINT ck_npc_bargain_qty CHECK(quantity BETWEEN 1 AND 10000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('105_npc_trade_bargaining') ON DUPLICATE KEY UPDATE version=VALUES(version);
