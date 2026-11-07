-- World map edit tools, transport routes and Garlean calendar-weather.
-- Calendar-based Garlean weather is displayed by default. Manual override remains available.
USE eclipse_order;

SET @region_mode_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_regions' AND COLUMN_NAME='weather_mode');
SET @sql := IF(@region_mode_exists=0,"ALTER TABLE world_regions ADD COLUMN weather_mode ENUM('manual','garlean_seasonal') NOT NULL DEFAULT 'garlean_seasonal'","SELECT 1");
PREPARE change_region FROM @sql; EXECUTE change_region; DEALLOCATE PREPARE change_region;

SET @icon_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_settlements' AND COLUMN_NAME='map_icon');
SET @sql := IF(@icon_exists=0,"ALTER TABLE world_settlements ADD COLUMN map_icon VARCHAR(32) NOT NULL DEFAULT 'settlement'","SELECT 1");
PREPARE change_icon FROM @sql; EXECUTE change_icon; DEALLOCATE PREPARE change_icon;

CREATE TABLE IF NOT EXISTS world_map_routes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 from_settlement_id BIGINT UNSIGNED NOT NULL,
 to_settlement_id BIGINT UNSIGNED NOT NULL,
 route_type ENUM('road','trail','rail','skyway','waterway') NOT NULL DEFAULT 'road',
 route_name VARCHAR(120) NOT NULL DEFAULT '',
 waypoints JSON NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_world_map_routes_region(region_id),
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(from_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(to_settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_world_route_distinct CHECK(from_settlement_id <> to_settlement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO schema_migrations(version) VALUES('042_world_routes_garlean_weather')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
