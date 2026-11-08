-- P3 Sites, Industry and Projects. Additive; no destructive inventory migration.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_industry_items (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 category ENUM('raw','refined','fuel','supply','byproduct') NOT NULL DEFAULT 'raw',
 workshop_material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 description VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (workshop_material_id) REFERENCES fc_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_catalog_lock (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO world_industry_catalog_lock(id) VALUES(1);
CREATE TABLE IF NOT EXISTS world_industry_templates (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 slug VARCHAR(70) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 category ENUM('mine','extraction','refinery','manufacturing','utilities','agriculture','other') NOT NULL DEFAULT 'other',
 current_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 archived TINYINT(1) NOT NULL DEFAULT 0,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (created_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_template_versions (
 template_id BIGINT UNSIGNED NOT NULL,
 version SMALLINT UNSIGNED NOT NULL,
 configuration JSON NOT NULL,
 rules JSON NOT NULL,
 published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 published_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 PRIMARY KEY(template_id,version),
 FOREIGN KEY(template_id) REFERENCES world_industry_templates(id) ON DELETE CASCADE,
 FOREIGN KEY(published_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_facilities (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settlement_id BIGINT UNSIGNED NOT NULL,
 owner_faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 template_id BIGINT UNSIGNED NOT NULL,
 template_version SMALLINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL,
 status ENUM('captured','liberated','ruined','rebuilding','operational','damaged','paused') NOT NULL DEFAULT 'ruined',
 level TINYINT UNSIGNED NOT NULL DEFAULT 1,
 capacity_pct TINYINT UNSIGNED NOT NULL DEFAULT 100,
 workforce INT UNSIGNED NOT NULL DEFAULT 0,
 heat_available DECIMAL(14,3) NOT NULL DEFAULT 0,
 power_available DECIMAL(14,3) NOT NULL DEFAULT 0,
 cycle_mode ENUM('off','manual','automatic') NOT NULL DEFAULT 'manual',
 cycle_cadence ENUM('slow','normal','fast') NOT NULL DEFAULT 'normal',
 last_cycle_key VARCHAR(35) NULL,
 notes VARCHAR(500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(owner_faction_id) REFERENCES order_factions(id) ON DELETE SET NULL,
 FOREIGN KEY(template_id,template_version) REFERENCES world_industry_template_versions(template_id,version),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_world_facility_settlement(settlement_id,status),
 INDEX ix_world_facility_cycle(cycle_mode,last_cycle_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_stock (
 facility_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
 PRIMARY KEY(facility_id,item_id),
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE CASCADE,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT chk_world_industry_nonnegative CHECK(quantity>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_projects (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 facility_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(140) NOT NULL,
 status ENUM('planned','active','paused','completed','cancelled') NOT NULL DEFAULT 'planned',
 result_status ENUM('liberated','rebuilding','operational','damaged') NOT NULL DEFAULT 'operational',
 labor_required INT UNSIGNED NOT NULL DEFAULT 100,
 labor_done INT UNSIGNED NOT NULL DEFAULT 0,
 campaign_project_id BIGINT UNSIGNED NULL,
 description VARCHAR(500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 finished_at DATETIME NULL,
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE CASCADE,
 FOREIGN KEY(campaign_project_id) REFERENCES order_construction_projects(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_world_industry_projects_facility(facility_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_project_needs (
 project_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 required_qty DECIMAL(15,3) NOT NULL,
 committed_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
 PRIMARY KEY(project_id,item_id),
 FOREIGN KEY(project_id) REFERENCES world_industry_projects(id) ON DELETE CASCADE,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT chk_world_project_need CHECK(required_qty>0 AND committed_qty>=0 AND committed_qty<=required_qty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_cycles (
 facility_id BIGINT UNSIGNED NOT NULL,
 cycle_key VARCHAR(35) NOT NULL,
 cycle_date DATE NOT NULL,
 operations INT UNSIGNED NOT NULL,
 configuration_version SMALLINT UNSIGNED NOT NULL,
 report JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(facility_id,cycle_key),
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_ledger (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 facility_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 delta DECIMAL(15,3) NOT NULL,
 balance_after DECIMAL(15,3) NOT NULL,
 action ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit') NOT NULL,
 reference_key VARCHAR(100) NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE CASCADE,
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id) ON DELETE SET NULL,
 INDEX ix_world_industry_ledger_facility(facility_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_industry_shared_receipts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 facility_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE CASCADE,
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO world_industry_items(id,name,category,workshop_material_id,description) VALUES
 ('iron-ore','Iron Ore','raw','iron-ore','Workshop-compatible iron ore'),
 ('iron-ingot','Iron Ingot','refined','iron-ingot','Refined iron for industry'),
 ('ceruleum-crude','Crude Ceruleum','raw',NULL,'Captured rig output'),
 ('ceruleum-fuel','Refined Ceruleum Fuel','fuel',NULL,'Refinery output'),
 ('mine-tailings','Mine Tailings','byproduct',NULL,'Mining waste'),
 ('refinery-residue','Refinery Residue','byproduct',NULL,'Refining residue'),
 ('repair-timbers','Repair Timbers','supply',NULL,'Committed reconstruction material');
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_industry_project_ticks (
 project_id BIGINT UNSIGNED NOT NULL,
 cycle_key VARCHAR(35) NOT NULL,
 labor_added INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(project_id,cycle_key),
 FOREIGN KEY(project_id) REFERENCES world_industry_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Re-running setup is safe and does not touch existing project contributions.

INSERT INTO schema_migrations(version) VALUES('054_world_industry_projects') ON DUPLICATE KEY UPDATE version=VALUES(version);
