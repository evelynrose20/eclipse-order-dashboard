-- Editable FC homebrew class definitions. Existing character records remain unchanged.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_homebrew_classes (
 id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 definition_json JSON NOT NULL,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_homebrew_class_author FOREIGN KEY(updated_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES ('010_homebrew_classes')
ON DUPLICATE KEY UPDATE version=VALUES(version);
