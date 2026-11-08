-- Full historic snapshots for in-place recipe edits.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_industry_template_edit_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 template_id BIGINT UNSIGNED NOT NULL,
 version SMALLINT UNSIGNED NOT NULL,
 configuration JSON NOT NULL,
 rules JSON NOT NULL,
 edited_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 edited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_template_edit_history(template_id,version,edited_at),
 FOREIGN KEY (template_id) REFERENCES world_industry_templates(id) ON DELETE CASCADE,
 FOREIGN KEY (edited_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('058_industry_template_edit_history') ON DUPLICATE KEY UPDATE version=VALUES(version);
