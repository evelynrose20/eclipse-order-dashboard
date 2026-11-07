-- Multi-event construction drives and collaborative crafting objectives.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_construction_projects (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(150) NOT NULL,
 description TEXT NOT NULL,
 location VARCHAR(160) NOT NULL DEFAULT '',
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 state ENUM('draft','open','paused','completed','archived') NOT NULL DEFAULT 'draft',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX ix_construction_state(state,id),
 FOREIGN KEY(event_id) REFERENCES order_encounters(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_construction_stages (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT UNSIGNED NOT NULL,
 position SMALLINT UNSIGNED NOT NULL,
 name VARCHAR(130) NOT NULL,
 description VARCHAR(1400) NOT NULL DEFAULT '',
 status ENUM('locked','active','complete') NOT NULL DEFAULT 'locked',
 completed_at DATETIME NULL,
 UNIQUE KEY uq_construction_stage_position(project_id,position),
 FOREIGN KEY(project_id) REFERENCES order_construction_projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_construction_requirements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 stage_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 required_quantity INT UNSIGNED NOT NULL,
 contributed_quantity INT UNSIGNED NOT NULL DEFAULT 0,
 UNIQUE KEY uq_construction_material(stage_id,material_id),
 FOREIGN KEY(stage_id) REFERENCES order_construction_stages(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_construction_contributions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT UNSIGNED NOT NULL,
 stage_id BIGINT UNSIGNED NOT NULL,
 requirement_id BIGINT UNSIGNED NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 source ENUM('reserved','shared') NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_construction_history(project_id,id),
 FOREIGN KEY(project_id) REFERENCES order_construction_projects(id),
 FOREIGN KEY(stage_id) REFERENCES order_construction_stages(id),
 FOREIGN KEY(requirement_id) REFERENCES order_construction_requirements(id),
 FOREIGN KEY(character_id) REFERENCES characters(id),
 FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('032_construction_projects')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
