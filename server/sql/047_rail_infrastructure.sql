-- Railway operational infrastructure. Additive to region/zone graph; never modifies map geometry.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_rail_stations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 zone_id BIGINT UNSIGNED NOT NULL,
 node_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL,
 status ENUM('planned','operational','closed','damaged') NOT NULL DEFAULT 'planned',
 freight_enabled TINYINT(1) NOT NULL DEFAULT 0,
 passenger_enabled TINYINT(1) NOT NULL DEFAULT 0,
 freight_capacity INT UNSIGNED NOT NULL DEFAULT 0,
 notes VARCHAR(1200) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_rail_station_node(node_id),
 KEY ix_rail_station_zone(region_id,zone_id),
 FOREIGN KEY(node_id) REFERENCES world_route_nodes(id) ON DELETE RESTRICT,
 FOREIGN KEY(zone_id) REFERENCES world_zones(id) ON DELETE RESTRICT,
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_rail_platforms (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 station_id BIGINT UNSIGNED NOT NULL,
 code VARCHAR(30) NOT NULL,
 kind ENUM('freight','passenger','mixed','siding') NOT NULL DEFAULT 'freight',
 track_length INT UNSIGNED NOT NULL DEFAULT 1,
 capacity INT UNSIGNED NOT NULL DEFAULT 0,
 status ENUM('operational','closed','damaged','planned') NOT NULL DEFAULT 'planned',
 UNIQUE KEY uq_rail_platform_code(station_id,code),
 FOREIGN KEY(station_id) REFERENCES world_rail_stations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_rail_switches (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 zone_id BIGINT UNSIGNED NOT NULL,
 node_id BIGINT UNSIGNED NOT NULL,
 entry_segment_id BIGINT UNSIGNED NOT NULL,
 exit_segment_id BIGINT UNSIGNED NOT NULL,
 status ENUM('open','closed','damaged') NOT NULL DEFAULT 'open',
 notes VARCHAR(500) NOT NULL DEFAULT '',
 UNIQUE KEY uq_rail_switch_pair(node_id,entry_segment_id,exit_segment_id),
 KEY ix_rail_switch_zone(region_id,zone_id),
 FOREIGN KEY(node_id) REFERENCES world_route_nodes(id) ON DELETE RESTRICT,
 FOREIGN KEY(entry_segment_id) REFERENCES world_route_segments(id) ON DELETE RESTRICT,
 FOREIGN KEY(exit_segment_id) REFERENCES world_route_segments(id) ON DELETE RESTRICT,
 FOREIGN KEY(zone_id) REFERENCES world_zones(id) ON DELETE RESTRICT,
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 CONSTRAINT chk_rail_switch_different CHECK(entry_segment_id <> exit_segment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_rail_crossings (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 zone_id BIGINT UNSIGNED NOT NULL,
 rail_segment_id BIGINT UNSIGNED NOT NULL,
 road_segment_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL DEFAULT '',
 map_x DECIMAL(6,2) NOT NULL,
 map_y DECIMAL(6,2) NOT NULL,
 control_type ENUM('gated','ungated','signal','grade_separated') NOT NULL DEFAULT 'gated',
 status ENUM('operational','closed','damaged','planned') NOT NULL DEFAULT 'planned',
 notes VARCHAR(500) NOT NULL DEFAULT '',
 KEY ix_rail_crossing_zone(region_id,zone_id),
 FOREIGN KEY(rail_segment_id) REFERENCES world_route_segments(id) ON DELETE RESTRICT,
 FOREIGN KEY(road_segment_id) REFERENCES world_route_segments(id) ON DELETE RESTRICT,
 FOREIGN KEY(zone_id) REFERENCES world_zones(id) ON DELETE RESTRICT,
 FOREIGN KEY(region_id) REFERENCES world_regions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('047_rail_infrastructure')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
