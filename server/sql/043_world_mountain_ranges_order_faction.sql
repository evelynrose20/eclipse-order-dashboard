-- World mountain overlays and a stable first-party Eclipse Order faction.
-- This migration does not assign ownership or alter existing settlements.
USE eclipse_order;
INSERT IGNORE INTO order_factions(id,name,leader,relationship,description,notes,public_visible,sort_order,faction_scope)
 VALUES('eclipse-order','The Eclipse Order','Domina','neutral',
 'The Order itself, available as a governing, controlling or supporting authority in world administration.',
 '',1,0,'order_story');

CREATE TABLE IF NOT EXISTS world_map_mountain_ranges (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 region_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL,
 points JSON NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_world_mountain_region(region_id),
 FOREIGN KEY(region_id) REFERENCES world_regions(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO schema_migrations(version) VALUES('043_world_mountain_ranges_order_faction')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
