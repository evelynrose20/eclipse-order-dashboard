-- Event participation XP awards. Re-runnable, does not touch existing characters.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_event_xp_awards (
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 amount INT UNSIGNED NOT NULL,
 granted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(event_id,character_id),
 CONSTRAINT fk_event_xp_event FOREIGN KEY(event_id) REFERENCES order_encounters(id) ON DELETE CASCADE,
 CONSTRAINT fk_event_xp_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_event_xp_actor FOREIGN KEY(granted_by) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('008_event_xp') ON DUPLICATE KEY UPDATE version=VALUES(version);
