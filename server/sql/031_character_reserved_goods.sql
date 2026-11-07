-- Crafted stock reserved by its maker's linked character.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS character_reserved_materials (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(character_id,material_id),
 FOREIGN KEY(character_id) REFERENCES characters(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS character_reserved_material_ledger (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action ENUM('craft','release','front_delivery') NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 balance_after INT UNSIGNED NOT NULL,
 front_id BIGINT UNSIGNED NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_reserved_history(character_id,id),
 FOREIGN KEY(character_id) REFERENCES characters(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('031_character_reserved_goods')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
