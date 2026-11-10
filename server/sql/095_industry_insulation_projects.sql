-- Industrial insulation panels fund new Order winterization civic projects.
-- Existing completed and active projects keep their original recipe; no retroactive mutation.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_insulation_needs (
 project_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'freight-insulation',
 required_qty DECIMAL(15,3) NOT NULL,
 committed_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
 FOREIGN KEY(project_id) REFERENCES world_civic_building_projects(id) ON DELETE CASCADE,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT ck_insulation_requirement CHECK(required_qty>0 AND committed_qty>=0 AND committed_qty<=required_qty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('095_industry_insulation_projects')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
