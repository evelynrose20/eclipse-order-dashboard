-- Site logistics: industrial sites reach transport hubs through real constructed access links.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_depot_links (
 facility_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 hub_settlement_id BIGINT UNSIGNED NOT NULL,
 mode ENUM('road','rail','air','sea','pack') NOT NULL DEFAULT 'road',
 state ENUM('planned','operational','damaged','closed') NOT NULL DEFAULT 'planned',
 travel_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
 construction_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 construction_quantity DECIMAL(15,3) NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY(hub_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(construction_item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT ck_depot_link_duration CHECK(travel_minutes BETWEEN 1 AND 10080),
 CONSTRAINT ck_depot_link_material CHECK(construction_quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('094_independent_site_logistics')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
