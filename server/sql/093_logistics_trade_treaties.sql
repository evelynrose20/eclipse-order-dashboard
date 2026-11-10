-- Faction-level trade permissions: goods cannot be shipped across borders without a treaty.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_trade_treaties (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 faction_a VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 faction_b VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 status ENUM('proposed','active','suspended','retired') NOT NULL DEFAULT 'proposed',
 purpose ENUM('trade','relief','military','industry') NOT NULL DEFAULT 'trade',
 notes VARCHAR(600) NOT NULL DEFAULT '',
 approved_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 approved_at DATETIME NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(faction_a) REFERENCES order_factions(id),
 FOREIGN KEY(faction_b) REFERENCES order_factions(id),
 FOREIGN KEY(approved_by) REFERENCES accounts(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 UNIQUE KEY uq_trade_treaty(faction_a,faction_b,purpose),
 CONSTRAINT chk_trade_pair CHECK(faction_a<>faction_b)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('093_logistics_trade_treaties')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
