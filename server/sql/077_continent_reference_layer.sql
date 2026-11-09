-- Persistent reference artwork is separate from editable continent geography.
-- A compressed WebP image is stored in the existing local world database,
-- so staff can upload a reference without needing a public image host.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_continent_reference (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 image_data MEDIUMTEXT NULL,
 original_name VARCHAR(180) NOT NULL DEFAULT '',
 opacity_pct TINYINT UNSIGNED NOT NULL DEFAULT 75,
 offset_x DECIMAL(7,2) NOT NULL DEFAULT 0,
 offset_y DECIMAL(7,2) NOT NULL DEFAULT 0,
 width_pct SMALLINT UNSIGNED NOT NULL DEFAULT 100,
 visible TINYINT(1) NOT NULL DEFAULT 1,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO world_continent_reference(id) VALUES(1);
INSERT INTO schema_migrations(version) VALUES('077_continent_reference_layer')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
