-- Fixed cardinal placement of maps within a region; overview zones are not grid tiles.
-- Legacy zones intentionally remain unplaced until an admin assigns them.
USE eclipse_order;
SET @zone_layout_x := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_zones' AND COLUMN_NAME='grid_x')=0,'ALTER TABLE world_zones ADD COLUMN grid_x INT NULL','SELECT 1');
PREPARE zone_geography FROM @zone_layout_x; EXECUTE zone_geography; DEALLOCATE PREPARE zone_geography;
SET @zone_layout_y := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_zones' AND COLUMN_NAME='grid_y')=0,'ALTER TABLE world_zones ADD COLUMN grid_y INT NULL','SELECT 1');
PREPARE zone_geography FROM @zone_layout_y; EXECUTE zone_geography; DEALLOCATE PREPARE zone_geography;
SET @zone_grid_unique := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_zones' AND INDEX_NAME='uq_world_zone_grid')=0,'ALTER TABLE world_zones ADD UNIQUE KEY uq_world_zone_grid(region_id,grid_x,grid_y)','SELECT 1');
PREPARE zone_geography FROM @zone_grid_unique; EXECUTE zone_geography; DEALLOCATE PREPARE zone_geography;
CREATE TABLE IF NOT EXISTS world_region_access (
 region_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 access_policy ENUM('ground_and_air','airship_only') NOT NULL DEFAULT 'ground_and_air',
 FOREIGN KEY(region_id) REFERENCES world_regions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('116_world_directional_geography')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
