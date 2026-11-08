-- Additive chamber seating and player-owned contribution preferences.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_thrall_contribution_preferences (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 allow_upper TINYINT(1) NOT NULL DEFAULT 0,
 allow_lower TINYINT(1) NOT NULL DEFAULT 0,
 upper_limit INT UNSIGNED NOT NULL DEFAULT 0,
 lower_limit INT UNSIGNED NOT NULL DEFAULT 0,
 allow_seating TINYINT(1) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_thrall_pref_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_thrall_seat (
 id TINYINT UNSIGNED PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 seated_at DATETIME NULL,
 placed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 upper_recorded INT UNSIGNED NOT NULL DEFAULT 0,
 lower_recorded INT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE SET NULL,
 FOREIGN KEY(placed_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_thrall_seat(id) VALUES(1);
INSERT INTO schema_migrations(version) VALUES('062_thrall_seating') ON DUPLICATE KEY UPDATE version=VALUES(version);
