-- Shared Order stores, cooperative gardens and craft recipes.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS fc_materials (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 category ENUM('ore','herb','botanical','refined','supply') NOT NULL,
 description VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fc_material_stock (
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 quantity INT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_stock_material FOREIGN KEY(material_id) REFERENCES fc_materials(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fc_material_ledger (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 delta INT NOT NULL,
 balance_after INT UNSIGNED NOT NULL,
 activity ENUM('gather','harvest','craft_input','craft_output','upgrade') NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 note VARCHAR(250) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_stock_ledger_material(material_id,id),
 CONSTRAINT fk_stock_ledger_material FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT fk_stock_ledger_account FOREIGN KEY(account_id) REFERENCES accounts(id),
 CONSTRAINT fk_stock_ledger_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE SET NULL,
 CONSTRAINT ck_stock_delta CHECK (delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fc_recipes (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 name VARCHAR(110) NOT NULL,
 description VARCHAR(450) NOT NULL DEFAULT '',
 output_material VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 output_quantity INT UNSIGNED NOT NULL DEFAULT 1,
 CONSTRAINT fk_recipe_output FOREIGN KEY(output_material) REFERENCES fc_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fc_recipe_inputs (
 recipe_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 PRIMARY KEY(recipe_id,material_id),
 CONSTRAINT fk_recipe_input_recipe FOREIGN KEY(recipe_id) REFERENCES fc_recipes(id) ON DELETE CASCADE,
 CONSTRAINT fk_recipe_input_material FOREIGN KEY(material_id) REFERENCES fc_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fc_garden (
 id TINYINT UNSIGNED PRIMARY KEY,
 level TINYINT UNSIGNED NOT NULL DEFAULT 1,
 CONSTRAINT ck_garden_level CHECK (level BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO fc_garden(id,level) VALUES(1,1);
CREATE TABLE IF NOT EXISTS fc_garden_plots (
 id TINYINT UNSIGNED PRIMARY KEY,
 crop_material VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 growth TINYINT UNSIGNED NOT NULL DEFAULT 0,
 health TINYINT UNSIGNED NOT NULL DEFAULT 80,
 harvests INT UNSIGNED NOT NULL DEFAULT 0,
 CONSTRAINT fk_plot_crop FOREIGN KEY(crop_material) REFERENCES fc_materials(id),
 CONSTRAINT ck_plot_growth CHECK(growth<=100),
 CONSTRAINT ck_plot_health CHECK(health<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS fc_garden_care (
 plot_id TINYINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 care_date DATE NOT NULL,
 action ENUM('water','tend') NOT NULL,
 PRIMARY KEY(plot_id,account_id,care_date),
 CONSTRAINT fk_care_plot FOREIGN KEY(plot_id) REFERENCES fc_garden_plots(id),
 CONSTRAINT fk_care_account FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO fc_materials(id,name,category,description) VALUES
('iron-ore','Iron Ore','ore','Found in mineral deposits'),
('moonstone','Moonstone Fragment','ore','A rare magical mineral'),
('wild-herbs','Wild Herbs','herb','Foraged medicinal greenery'),
('duskbloom','Duskbloom','botanical','Garden-grown dusk petals'),
('silverleaf','Silverleaf','botanical','Hardy fragrant leaf'),
('iron-ingot','Iron Ingot','refined','Prepared metal for the workshop'),
('herbal-tonic','Herbal Tonic','supply','An ordinary restorative provision'),
('veiled-essence','Veiled Essence','supply','A fictional alchemical RP reagent'),
('trade-crate','Merchant Supply Crate','supply','Packed goods for legitimate trade fronts');
INSERT IGNORE INTO fc_recipes(id,name,description,output_material,output_quantity) VALUES
('smelt-iron','Smelt Iron','Refine mineral stock into workshop metal','iron-ingot',1),
('herbal-tonic','Prepare Herbal Tonic','Prepare a general-purpose fantasy tonic','herbal-tonic',1),
('veiled-essence','Distill Veiled Essence','Abstract alchemical RP crafting','veiled-essence',1),
('trade-crate','Assemble Merchant Crate','Pack supplies for a trading front','trade-crate',1);
INSERT IGNORE INTO fc_recipe_inputs(recipe_id,material_id,quantity) VALUES
('smelt-iron','iron-ore',3),
('herbal-tonic','wild-herbs',2),('herbal-tonic','silverleaf',1),
('veiled-essence','duskbloom',2),('veiled-essence','moonstone',1),
('trade-crate','iron-ingot',1),('trade-crate','wild-herbs',2);
INSERT IGNORE INTO fc_garden_plots(id,crop_material) VALUES(1,'duskbloom'),(2,'silverleaf');
INSERT INTO schema_migrations(version) VALUES('020_fc_crafting_garden')
ON DUPLICATE KEY UPDATE version=VALUES(version);
