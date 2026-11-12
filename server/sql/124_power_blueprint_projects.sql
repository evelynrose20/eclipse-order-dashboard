-- Power buildings use the same material-funded, time-progressed model as settlement restoration.
USE eclipse_order;
INSERT IGNORE INTO fc_materials(id,name,category,description) VALUES ('repair-timbers','Repair Timbers','refined','Processed structural timber for settlement projects');
-- Link industry-produced repair timber to the existing shared workshop transfer workflow.
UPDATE world_industry_items SET workshop_material_id='repair-timbers' WHERE id='repair-timbers' AND workshop_material_id IS NULL;
CREATE TABLE IF NOT EXISTS world_power_blueprints(
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 name VARCHAR(110) NOT NULL,
 technology_level SMALLINT UNSIGNED NOT NULL,
 rated_output DECIMAL(10,2) NOT NULL,
 fuel_per_day DECIMAL(10,3) NOT NULL,
 material_iron INT UNSIGNED NOT NULL,
 material_timber INT UNSIGNED NOT NULL,
 labor_required INT UNSIGNED NOT NULL,
 description VARCHAR(300) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO world_power_blueprints(id,name,technology_level,rated_output,fuel_per_day,material_iron,material_timber,labor_required,description) VALUES
('garlean-mk1','Obsolete Garlean Ceruleum Mk.I',1,180,100,60,80,120,'Old and inefficient; retained for historic or damaged installations'),
('garlean-mk2','Garlean Ceruleum Mk.II',2,280,80,120,100,240,'Serviceable regional power equipment'),
('garlean-mk3','Garlean Ceruleum Mk.III',3,420,65,220,160,480,'Modern high-efficiency settlement generator'),
('garlean-magitek','Imperial Magitek Power Core',4,650,50,380,220,850,'Advanced high-output ceruleum power core');
SET @p124=(SELECT IF(COUNT(*)=0,'ALTER TABLE world_power_plants ADD COLUMN blueprint_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL','DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_power_plants' AND COLUMN_NAME='blueprint_id');
PREPARE s124 FROM @p124;EXECUTE s124;DEALLOCATE PREPARE s124;
SET @p124=(SELECT IF(COUNT(*)=0,'ALTER TABLE world_power_plants ADD COLUMN level SMALLINT UNSIGNED NOT NULL DEFAULT 1','DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_power_plants' AND COLUMN_NAME='level');
PREPARE s124 FROM @p124;EXECUTE s124;DEALLOCATE PREPARE s124;
UPDATE world_power_plants SET blueprint_id='garlean-mk1',level=1 WHERE blueprint_id IS NULL;
CREATE TABLE IF NOT EXISTS world_power_projects(
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 plant_id BIGINT UNSIGNED NULL,
 settlement_id BIGINT UNSIGNED NOT NULL,
 blueprint_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action ENUM('construct','repair','upgrade','replace') NOT NULL,
 status ENUM('active','complete','cancelled') NOT NULL DEFAULT 'active',
 progress INT UNSIGNED NOT NULL DEFAULT 0,
 labor_required INT UNSIGNED NOT NULL,
 iron_required INT UNSIGNED NOT NULL,
 timber_required INT UNSIGNED NOT NULL,
 iron_committed INT UNSIGNED NOT NULL DEFAULT 0,
 timber_committed INT UNSIGNED NOT NULL DEFAULT 0,
 last_advanced DATE NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME NULL,
 FOREIGN KEY(plant_id) REFERENCES world_power_plants(id),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 FOREIGN KEY(blueprint_id) REFERENCES world_power_blueprints(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_power_project_settlement(settlement_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_power_project_contributions(
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(project_id) REFERENCES world_power_projects(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('124_power_blueprint_projects') ON DUPLICATE KEY UPDATE version=VALUES(version);
