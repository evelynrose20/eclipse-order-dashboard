-- Menu-based internal Order railway logistics. Does NOT delete old visual railway data.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_internal_rail_stations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 stop_type ENUM('settlement','front') NOT NULL,
 stop_id BIGINT UNSIGNED NOT NULL,
 status ENUM('planned','operational','closed') NOT NULL DEFAULT 'planned',
 platforms INT UNSIGNED NOT NULL DEFAULT 1,
 notes VARCHAR(1200) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_internal_rail_station_stop(stop_type,stop_id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT ck_internal_rail_platforms CHECK(platforms BETWEEN 1 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_internal_rail_routes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 from_station_id BIGINT UNSIGNED NULL,
 to_station_id BIGINT UNSIGNED NULL,
 from_type ENUM('settlement','front') NOT NULL,
 from_id BIGINT UNSIGNED NOT NULL,
 to_type ENUM('settlement','front') NOT NULL,
 to_id BIGINT UNSIGNED NOT NULL,
 duration_minutes INT UNSIGNED NOT NULL DEFAULT 60,
 status ENUM('active','paused','retired') NOT NULL DEFAULT 'active',
 cargo_notes VARCHAR(1200) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_internal_rail_status(status,id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 FOREIGN KEY(from_station_id) REFERENCES order_internal_rail_stations(id) ON DELETE RESTRICT,
 FOREIGN KEY(to_station_id) REFERENCES order_internal_rail_stations(id) ON DELETE RESTRICT,
 CONSTRAINT ck_internal_rail_distinct CHECK(NOT(from_type=to_type AND from_id=to_id)),
 CONSTRAINT ck_internal_rail_duration CHECK(duration_minutes BETWEEN 1 AND 10080)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_internal_rail_journeys (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 route_id BIGINT UNSIGNED NOT NULL,
 departed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 expected_arrival_at DATETIME(3) NOT NULL,
 status ENUM('running','arrived','cancelled') NOT NULL DEFAULT 'running',
 notes VARCHAR(1200) NOT NULL DEFAULT '',
 dispatched_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 completed_at DATETIME(3) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY ix_internal_rail_journeys(route_id,status,departed_at),
 FOREIGN KEY(route_id) REFERENCES order_internal_rail_routes(id) ON DELETE RESTRICT,
 FOREIGN KEY(dispatched_by) REFERENCES accounts(id),
 CONSTRAINT ck_internal_rail_arrival CHECK(expected_arrival_at > departed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('049_internal_rail_logistics')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
