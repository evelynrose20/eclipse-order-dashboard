-- Daily per-character production balances. Midnight UTC is the reset boundary.
-- Records for previous days remain for history; storage/reservoirs are never reset.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_thrall_daily_output (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 cycle_date DATE NOT NULL,
 upper_used INT UNSIGNED NOT NULL DEFAULT 0,
 lower_used INT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(character_id,cycle_date),
 CONSTRAINT fk_thrall_daily_output_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('065_chamber_daily_output') ON DUPLICATE KEY UPDATE version=VALUES(version);
