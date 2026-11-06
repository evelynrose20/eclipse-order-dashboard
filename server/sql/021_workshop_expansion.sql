-- Extend the FC workshop with an editable catalog and expedition records.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS fc_gathering_runs (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity TINYINT UNSIGNED NOT NULL,
 expedition_day DATE NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_expedition_daily (account_id,expedition_day),
 CONSTRAINT fk_expedition_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
 CONSTRAINT fk_expedition_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE RESTRICT,
 CONSTRAINT fk_expedition_material FOREIGN KEY(material_id) REFERENCES fc_materials(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('021_workshop_expansion')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
