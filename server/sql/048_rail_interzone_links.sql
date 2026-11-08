-- Explicit, coordinate-independent rail connections between geographic map zones.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_rail_interzone_links (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 from_station_id BIGINT UNSIGNED NOT NULL,
 to_station_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL DEFAULT '',
 status ENUM('planned','operational','closed','damaged') NOT NULL DEFAULT 'planned',
 bidirectional TINYINT(1) NOT NULL DEFAULT 1,
 freight_enabled TINYINT(1) NOT NULL DEFAULT 1,
 notes VARCHAR(1200) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_interzone_station_pair(from_station_id,to_station_id),
 KEY ix_interzone_dest(to_station_id),
 FOREIGN KEY(from_station_id) REFERENCES world_rail_stations(id) ON DELETE RESTRICT,
 FOREIGN KEY(to_station_id) REFERENCES world_rail_stations(id) ON DELETE RESTRICT,
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT chk_interzone_distinct CHECK(from_station_id<>to_station_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('048_rail_interzone_links') ON DUPLICATE KEY UPDATE version=VALUES(version);
