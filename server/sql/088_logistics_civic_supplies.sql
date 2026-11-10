-- P4 civilian supply bridge: classify industrial goods once, deliver arriving freight into real civic stock.
USE eclipse_order;
INSERT IGNORE INTO world_industry_items(id,name,category,workshop_material_id,description) VALUES
 ('freight-grain','Grain Shipments','supply',NULL,'Bulk food shipment from farms'),
 ('freight-vegetables','Vegetable Shipments','supply',NULL,'Preserved regional vegetable shipment'),
 ('freight-fish','Preserved Fish','supply',NULL,'Coastal food shipment'),
 ('freight-medicine','Medical Supplies','supply',NULL,'Medicines prepared for settlement hospitals'),
 ('freight-insulation','Insulation Panels','supply',NULL,'Industry-manufactured winterization materials');
CREATE TABLE IF NOT EXISTS world_logistics_civic_item_types (
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 resource_kind ENUM('food','fuel','water','medicine') NOT NULL,
 food_group VARCHAR(75) NULL,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO world_logistics_civic_item_types(item_id,resource_kind,food_group) VALUES
 ('ceruleum-fuel','fuel',NULL),('freight-grain','food','grain'),
 ('freight-vegetables','food','vegetables'),('freight-fish','food','fish'),
 ('freight-medicine','medicine',NULL);
CREATE TABLE IF NOT EXISTS world_logistics_civic_receipts (
 shipment_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE world_industry_ledger MODIFY COLUMN action
 ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit','military_supply','freight_dispatch','freight_arrival','freight_refund','freight_fuel','civic_delivery','corridor_build','military_delivery') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('088_logistics_civic_supplies')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
