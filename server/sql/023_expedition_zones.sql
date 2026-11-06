-- Editable expedition zones with zone-specific resources, character level gates and outcome text.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS fc_expedition_zones (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 name VARCHAR(110) NOT NULL,
 description VARCHAR(900) NOT NULL DEFAULT '',
 minimum_level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 danger ENUM('low','moderate','high','extreme') NOT NULL DEFAULT 'low',
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 100,
 CONSTRAINT ck_zone_level CHECK (minimum_level BETWEEN 1 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS fc_expedition_zone_materials (
 zone_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 minimum_level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 PRIMARY KEY(zone_id,material_id),
 CONSTRAINT fk_zone_mat_zone FOREIGN KEY(zone_id) REFERENCES fc_expedition_zones(id) ON DELETE CASCADE,
 CONSTRAINT fk_zone_mat_material FOREIGN KEY(material_id) REFERENCES fc_materials(id) ON DELETE RESTRICT,
 CONSTRAINT ck_zone_mat_level CHECK (minimum_level BETWEEN 1 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve existing crafting progress and expedition records. ALTER only when columns are missing.
SET @has_recipe_level := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_recipes' AND COLUMN_NAME='minimum_level');
SET @stmt := IF(@has_recipe_level=0,'ALTER TABLE fc_recipes ADD COLUMN minimum_level SMALLINT UNSIGNED NOT NULL DEFAULT 1','SELECT 1');
PREPARE migration_stmt FROM @stmt; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @has_run_zone := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_gathering_runs' AND COLUMN_NAME='zone_id');
SET @stmt := IF(@has_run_zone=0,'ALTER TABLE fc_gathering_runs ADD COLUMN zone_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL','SELECT 1');
PREPARE migration_stmt FROM @stmt; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @has_fail := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_expedition_scenarios' AND COLUMN_NAME='failure_text');
SET @stmt := IF(@has_fail=0,"ALTER TABLE fc_expedition_scenarios ADD COLUMN failure_text VARCHAR(900) NOT NULL DEFAULT 'The expedition ends in defeat.'",'SELECT 1');
PREPARE migration_stmt FROM @stmt; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @has_retreat := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_expedition_scenarios' AND COLUMN_NAME='retreat_text');
SET @stmt := IF(@has_retreat=0,"ALTER TABLE fc_expedition_scenarios ADD COLUMN retreat_text VARCHAR(900) NOT NULL DEFAULT 'You withdraw from the encounter.'",'SELECT 1');
PREPARE migration_stmt FROM @stmt; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @has_decline := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_expedition_scenarios' AND COLUMN_NAME='decline_text');
SET @stmt := IF(@has_decline=0,"ALTER TABLE fc_expedition_scenarios ADD COLUMN decline_text VARCHAR(900) NOT NULL DEFAULT 'You decline the encounter and continue safely.'",'SELECT 1');
PREPARE migration_stmt FROM @stmt; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

INSERT IGNORE INTO fc_expedition_zones(id,name,description,minimum_level,danger,sort_order) VALUES
 ('estate-woodlands','Estate Woodlands','Sheltered trails near the Order estate, suitable for novice foragers.',1,'low',10),
 ('ironridge-quarry','Ironridge Quarry','Steep mineral seams and territorial wildlife further from the estate.',5,'moderate',20),
 ('moonfall-highlands','Moonfall Highlands','Remote cliffs rich in unusual magical minerals.',12,'high',30);
INSERT IGNORE INTO fc_expedition_zone_materials(zone_id,material_id,minimum_level) VALUES
 ('estate-woodlands','wild-herbs',1),
 ('ironridge-quarry','iron-ore',5),
 ('ironridge-quarry','wild-herbs',5),
 ('moonfall-highlands','moonstone',12);
-- The existing recipes remain available to novice crafters until their level requirements are configured.
INSERT INTO schema_migrations(version) VALUES('023_expedition_zones')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
