-- Rivers are geographical features, not roads, transport routes or network edges.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_map_rivers (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 zone_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL,
 points JSON NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_map_rivers_zone(region_id,zone_id),
 FOREIGN KEY(region_id) REFERENCES world_regions(id) ON DELETE RESTRICT,
 FOREIGN KEY(zone_id) REFERENCES world_zones(id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('079_map_rivers')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
