-- Durable shared transport graph. Legacy world_map_routes is retained until explicitly imported.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_route_nodes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 settlement_id BIGINT UNSIGNED NULL,
 name VARCHAR(120) NOT NULL DEFAULT '',
 node_kind ENUM('junction','rail_switch','terminal') NOT NULL DEFAULT 'junction',
 map_x DECIMAL(6,2) NOT NULL,
 map_y DECIMAL(6,2) NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 KEY ix_route_nodes_region(region_id),
 UNIQUE KEY uq_route_node_settlement(region_id,settlement_id),
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_route_segments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 from_node_id BIGINT UNSIGNED NOT NULL,
 to_node_id BIGINT UNSIGNED NOT NULL,
 route_type ENUM('road','trail','rail','skyway','waterway') NOT NULL DEFAULT 'road',
 route_name VARCHAR(120) NOT NULL DEFAULT '',
 waypoints JSON NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_route_segments_region(region_id),
 KEY ix_route_segments_from(from_node_id),
 KEY ix_route_segments_to(to_node_id),
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(from_node_id) REFERENCES world_route_nodes(id),
 FOREIGN KEY(to_node_id) REFERENCES world_route_nodes(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_route_segment_distinct CHECK(from_node_id <> to_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('045_world_transport_graph')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
