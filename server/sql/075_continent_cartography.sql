-- Persistent continent-wide cartography, separate from historical per-zone local maps.
-- Nothing is automatically assigned invented geographic coordinates.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_continent_settings (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 name VARCHAR(140) NOT NULL DEFAULT 'The Continent',
 background_url VARCHAR(1500) NOT NULL DEFAULT '',
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO world_continent_settings(id,name,background_url) VALUES(1,'The Continent','');
CREATE TABLE IF NOT EXISTS world_continent_territories (
 zone_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 polygon JSON NOT NULL,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(zone_id) REFERENCES world_zones(id) ON DELETE CASCADE,
 FOREIGN KEY(updated_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('075_continent_cartography')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
