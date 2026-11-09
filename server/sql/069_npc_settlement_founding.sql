-- One-time NPC settlement founding package. Never reapplied on simulation restart or re-enable.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_npc_settlement_foundings (
 settlement_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 founding_population INT UNSIGNED NOT NULL DEFAULT 0,
 starter_housing_id BIGINT UNSIGNED NULL,
 starter_facility_id BIGINT UNSIGNED NULL,
 founded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(starter_housing_id) REFERENCES world_settlement_upgrades(id) ON DELETE SET NULL,
 FOREIGN KEY(starter_facility_id) REFERENCES world_industry_facilities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- System-owned NPC facilities have no human creator; staff-created facilities retain their actual owner.
ALTER TABLE world_industry_facilities MODIFY COLUMN created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL;
INSERT INTO schema_migrations(version) VALUES('069_npc_settlement_founding')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
