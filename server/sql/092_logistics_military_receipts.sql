-- Military supply handoff: freight must arrive before a castrum receives war stores.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_military_receipts (
 shipment_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 installation_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id),
 FOREIGN KEY(installation_id) REFERENCES world_military_installations(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE world_industry_ledger MODIFY COLUMN action ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit','military_supply','freight_dispatch','freight_arrival','freight_refund','freight_fuel','civic_delivery','corridor_build','military_delivery') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('092_logistics_military_receipts')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
