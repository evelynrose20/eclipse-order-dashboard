-- Explicit places where two regions can meet, independently of internal zone grids.
-- A land border has facing map edges. An air corridor needs no shared border.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_region_connections (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 from_region_id BIGINT UNSIGNED NOT NULL,
 from_zone_id BIGINT UNSIGNED NOT NULL,
 to_region_id BIGINT UNSIGNED NOT NULL,
 to_zone_id BIGINT UNSIGNED NOT NULL,
 connection_kind ENUM('ground','airship') NOT NULL,
 direction ENUM('north','south','east','west') NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_region_connection(from_zone_id,to_zone_id,connection_kind,direction),
 KEY ix_connection_to_region(to_region_id),
 FOREIGN KEY(from_region_id) REFERENCES world_regions(id),
 FOREIGN KEY(to_region_id) REFERENCES world_regions(id),
 FOREIGN KEY(from_zone_id) REFERENCES world_zones(id),
 FOREIGN KEY(to_zone_id) REFERENCES world_zones(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_region_connection_diff CHECK(from_region_id <> to_region_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('117_world_region_connections')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
