USE eclipse_order;
-- Staff research catalog. Character participation is independently owner-authorized.
CREATE TABLE IF NOT EXISTS character_lineage_permissions (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 allow_research TINYINT(1) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_lineage_projects (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(130) NOT NULL,
 objective VARCHAR(900) NOT NULL DEFAULT '',
 status ENUM('planned','active','paused','completed','archived') NOT NULL DEFAULT 'planned',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_lineage_cases (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT UNSIGNED NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 designation VARCHAR(130) NOT NULL,
 method VARCHAR(900) NOT NULL DEFAULT '',
 observations TEXT NULL,
 lineage_markers VARCHAR(600) NOT NULL DEFAULT '',
 result ENUM('ongoing','inconclusive','promising','unsuccessful','confirmed') NOT NULL DEFAULT 'ongoing',
 pregnancy_linked TINYINT(1) NOT NULL DEFAULT 0,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX ix_lineage_case_project(project_id),
 FOREIGN KEY(project_id) REFERENCES order_lineage_projects(id),
 FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE SET NULL,
 FOREIGN KEY(updated_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('125_imperial_lineage_project')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
