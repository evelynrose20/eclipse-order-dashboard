-- Project-specific civilian construction supply commitments.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_civic_project_contributions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 contributed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(project_id) REFERENCES world_civic_building_projects(id) ON DELETE RESTRICT,
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 INDEX ix_civic_project_contributions(project_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- The existing materials_paid field now means fully funded, not automatically charged.
INSERT INTO schema_migrations(version) VALUES('066_civic_project_contributions')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
