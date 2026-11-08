-- Multiple material types per civic building recipe and per construction project.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_civic_template_materials (
 template_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 units_per_level INT UNSIGNED NOT NULL,
 PRIMARY KEY(template_id,material_id),
 FOREIGN KEY(template_id) REFERENCES world_civic_building_templates(id) ON DELETE CASCADE,
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT chk_civic_template_material_units CHECK(units_per_level>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_civic_project_needs (
 project_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 required_qty INT UNSIGNED NOT NULL,
 committed_qty INT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(project_id,material_id),
 FOREIGN KEY(project_id) REFERENCES world_civic_building_projects(id) ON DELETE RESTRICT,
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT chk_civic_need_bounds CHECK(required_qty>0 AND committed_qty<=required_qty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Seed only missing recipe materials. Recipe editors can subsequently replace these rows.
INSERT IGNORE INTO world_civic_template_materials(template_id,material_id,units_per_level)
 SELECT id,material_id,material_per_level FROM world_civic_building_templates;
-- Import existing project requirements and their historical contributions.
INSERT IGNORE INTO world_civic_project_needs(project_id,material_id,required_qty,committed_qty)
 SELECT p.id,p.material_id,p.material_required,LEAST(p.material_required,COALESCE(c.contributed,0))
 FROM world_civic_building_projects p
 LEFT JOIN (SELECT project_id,material_id,SUM(quantity) AS contributed FROM world_civic_project_contributions GROUP BY project_id,material_id) c
  ON c.project_id=p.id AND c.material_id=p.material_id
 WHERE p.owner_kind='order' AND p.material_id IS NOT NULL AND p.material_required>0;
-- Historical fully funded projects (from before the commit UI) remain funded.
UPDATE world_civic_project_needs n JOIN world_civic_building_projects p ON p.id=n.project_id
 SET n.committed_qty=n.required_qty
 WHERE p.materials_paid=1 AND p.owner_kind='order';
INSERT INTO schema_migrations(version) VALUES('067_civic_multimaterial_projects')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
