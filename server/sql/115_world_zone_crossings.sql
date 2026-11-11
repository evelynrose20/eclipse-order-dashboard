-- Paired zone and region exits on the existing road/rail graph.
-- Both endpoint nodes are ordinary route junctions; the link is a separate edge.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_zone_crossings (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 route_type ENUM('road','trail','rail') NOT NULL,
 crossing_kind ENUM('road','rail','mountain_pass','border_checkpoint','footpath') NOT NULL DEFAULT 'road',
 status ENUM('operational','damaged','closed') NOT NULL DEFAULT 'operational',
 from_region_id BIGINT UNSIGNED NOT NULL,
 from_zone_id BIGINT UNSIGNED NOT NULL,
 from_node_id BIGINT UNSIGNED NOT NULL,
 to_region_id BIGINT UNSIGNED NOT NULL,
 to_zone_id BIGINT UNSIGNED NOT NULL,
 to_node_id BIGINT UNSIGNED NOT NULL,
 travel_minutes INT UNSIGNED NOT NULL DEFAULT 30,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY ix_crossing_from_zone(from_zone_id),
 KEY ix_crossing_to_zone(to_zone_id),
 KEY ix_crossing_state(status,route_type),
 FOREIGN KEY(from_region_id) REFERENCES world_regions(id),
 FOREIGN KEY(to_region_id) REFERENCES world_regions(id),
 FOREIGN KEY(from_zone_id) REFERENCES world_zones(id),
 FOREIGN KEY(to_zone_id) REFERENCES world_zones(id),
 FOREIGN KEY(from_node_id) REFERENCES world_route_nodes(id),
 FOREIGN KEY(to_node_id) REFERENCES world_route_nodes(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_crossing_zones CHECK(from_zone_id <> to_zone_id),
 CONSTRAINT chk_crossing_nodes CHECK(from_node_id <> to_node_id),
 CONSTRAINT chk_crossing_minutes CHECK(travel_minutes BETWEEN 1 AND 10080)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('115_world_zone_crossings')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
