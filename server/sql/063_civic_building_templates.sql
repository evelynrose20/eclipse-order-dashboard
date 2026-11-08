-- Template-backed settlement industry; existing manually created buildings remain intact.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_civic_building_templates (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 description VARCHAR(400) NOT NULL DEFAULT '',
 category ENUM('housing','defense','clinic','water','food_storage','insulation','public_works','school') NOT NULL,
 effect_key ENUM('housing_capacity','defense','medical_access','water_daily','food_capacity','insulation','public_works','school_places') NOT NULL,
 effect_per_level INT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'iron-ingot',
 material_per_level INT UNSIGNED NOT NULL,
 npc_development_cost INT UNSIGNED NOT NULL,
 construction_labor INT UNSIGNED NOT NULL,
 max_level TINYINT UNSIGNED NOT NULL DEFAULT 5,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT chk_civic_template_levels CHECK(max_level BETWEEN 1 AND 10),
 CONSTRAINT chk_civic_template_effect CHECK(effect_per_level>0 AND effect_per_level<=100000),
 CONSTRAINT chk_civic_template_cost CHECK(material_per_level>=1 AND npc_development_cost>=1 AND construction_labor>=10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Insert only missing defaults, never overwrite staff-edited template recipes.
INSERT IGNORE INTO world_civic_building_templates
(id,name,description,category,effect_key,effect_per_level,material_id,material_per_level,npc_development_cost,construction_labor,max_level)
VALUES
('residential-quarter','Residential Quarter','Housing for new residents.','housing','housing_capacity',30,'iron-ingot',20,12,100,6),
('perimeter-defenses','Perimeter Defenses','Walls, watchtowers and garrison works.','defense','defense',10,'iron-ingot',35,14,140,6),
('civic-clinic','Civic Clinic','More medical services and treatment infrastructure.','clinic','medical_access',12,'iron-ingot',30,16,125,6),
('waterworks','Waterworks','Produces fresh water each settlement cycle and increases water access.','water','water_daily',35,'iron-ingot',25,12,110,8),
('granary','Granary','Raises the settlement food storage limit.','food_storage','food_capacity',250,'iron-ingot',30,15,135,8),
('winterproof-housing','Weatherproofing','Protects housing and public facilities from cold.','insulation','insulation',12,'iron-ingot',25,15,120,6),
('public-works','Public Works','Improves common services, roads and maintenance.','public_works','public_works',12,'iron-ingot',25,14,130,6),
('community-school','Community School','Provides places for children and youth to learn.','school','school_places',45,'iron-ingot',35,18,150,6);
-- Add columns only if missing; production Windows setup is repeatable.
SET @template_fk_col := (SELECT IF(COUNT(*)=0,'ALTER TABLE world_settlement_upgrades ADD COLUMN template_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL','DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_settlement_upgrades' AND column_name='template_id');
PREPARE civic_template_col FROM @template_fk_col; EXECUTE civic_template_col; DEALLOCATE PREPARE civic_template_col;
SET @effect_col := (SELECT IF(COUNT(*)=0,'ALTER TABLE world_settlement_upgrades ADD COLUMN effect_snapshot JSON NULL','DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_settlement_upgrades' AND column_name='effect_snapshot');
PREPARE civic_effect_col FROM @effect_col; EXECUTE civic_effect_col; DEALLOCATE PREPARE civic_effect_col;
SET @revision_col := (SELECT IF(COUNT(*)=0,'ALTER TABLE world_settlement_upgrades ADD COLUMN template_revision INT UNSIGNED NULL','DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_settlement_upgrades' AND column_name='template_revision');
PREPARE civic_revision_col FROM @revision_col; EXECUTE civic_revision_col; DEALLOCATE PREPARE civic_revision_col;
ALTER TABLE world_settlement_upgrades MODIFY COLUMN created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL;
CREATE TABLE IF NOT EXISTS world_civic_building_projects (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 upgrade_id BIGINT UNSIGNED NOT NULL,
 settlement_id BIGINT UNSIGNED NOT NULL,
 template_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 target_level TINYINT UNSIGNED NOT NULL,
 effect_snapshot JSON NOT NULL,
 template_revision INT UNSIGNED NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 status ENUM('active','completed','paused') NOT NULL DEFAULT 'active',
 progress INT UNSIGNED NOT NULL DEFAULT 0,
 labor_required INT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 material_required INT UNSIGNED NOT NULL DEFAULT 0,
 materials_paid TINYINT(1) NOT NULL DEFAULT 0,
 npc_development_cost INT UNSIGNED NOT NULL DEFAULT 0,
 owner_kind ENUM('npc','order') NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TIMESTAMP NULL,
 FOREIGN KEY(upgrade_id) REFERENCES world_settlement_upgrades(id) ON DELETE CASCADE,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(template_id) REFERENCES world_civic_building_templates(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 INDEX ix_civic_project_settlement(settlement_id,status),
 UNIQUE KEY uq_civic_project_level(upgrade_id,target_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_building_project_ticks(
 project_id BIGINT UNSIGNED NOT NULL,
 cycle_key VARCHAR(35) NOT NULL,
 labor_added INT UNSIGNED NOT NULL,
 PRIMARY KEY(project_id,cycle_key),
 FOREIGN KEY(project_id) REFERENCES world_civic_building_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('063_civic_building_templates') ON DUPLICATE KEY UPDATE version=VALUES(version);
