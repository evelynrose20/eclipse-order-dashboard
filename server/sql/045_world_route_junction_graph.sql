-- Shared route junctions: existing roads/railways remain intact.
-- Each endpoint can now be a saved settlement or a saved map junction.
USE eclipse_order;

CREATE TABLE IF NOT EXISTS world_map_junctions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL DEFAULT '',
 junction_type ENUM('road','rail','multimodal') NOT NULL DEFAULT 'road',
 map_x DECIMAL(5,2) NOT NULL,
 map_y DECIMAL(5,2) NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 KEY ix_world_junction_region(region_id),
 CONSTRAINT chk_world_junction_coords CHECK (map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Older routes already point to settlements. Making these FK columns nullable
-- permits newer junction endpoints without rewriting any existing routes.
ALTER TABLE world_map_routes
 MODIFY COLUMN from_settlement_id BIGINT UNSIGNED NULL,
 MODIFY COLUMN to_settlement_id BIGINT UNSIGNED NULL;

SET @from_junction_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_map_routes' AND COLUMN_NAME='from_junction_id');
SET @junction_sql := IF(@from_junction_exists=0,"ALTER TABLE world_map_routes ADD COLUMN from_junction_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_world_route_from_junction FOREIGN KEY(from_junction_id) REFERENCES world_map_junctions(id)","SELECT 1");
PREPARE add_from_junction FROM @junction_sql; EXECUTE add_from_junction; DEALLOCATE PREPARE add_from_junction;

SET @to_junction_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_map_routes' AND COLUMN_NAME='to_junction_id');
SET @junction_sql := IF(@to_junction_exists=0,"ALTER TABLE world_map_routes ADD COLUMN to_junction_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_world_route_to_junction FOREIGN KEY(to_junction_id) REFERENCES world_map_junctions(id)","SELECT 1");
PREPARE add_to_junction FROM @junction_sql; EXECUTE add_to_junction; DEALLOCATE PREPARE add_to_junction;

INSERT INTO schema_migrations(version) VALUES('045_world_route_junction_graph')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
