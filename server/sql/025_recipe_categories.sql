-- Crafting professions are independent of material storage categories.
-- Existing recipes keep their ingredients, outputs and levels.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS fc_recipe_categories (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 name VARCHAR(90) NOT NULL,
 description VARCHAR(240) NOT NULL DEFAULT '',
 sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 100
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO fc_recipe_categories(id,name,description,sort_order) VALUES
 ('refining','Smelting & Refining','Ore, metals and processed materials.',10),
 ('alchemy','Alchemy','Magical and occult reagents.',20),
 ('tonics','Tonics & Remedies','Restoratives, remedies and herbal preparations.',30),
 ('provisions','Trade & Provisions','Crates, packaged goods and everyday supplies.',40),
 ('other','Other Crafts','Unsorted and specialist recipes.',90);
SET @has_category := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_recipes' AND COLUMN_NAME='category_id');
SET @category_ddl := IF(@has_category=0,"ALTER TABLE fc_recipes ADD COLUMN category_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'other'","SELECT 1");
PREPARE recipe_category_stmt FROM @category_ddl; EXECUTE recipe_category_stmt; DEALLOCATE PREPARE recipe_category_stmt;
-- Assign known starter recipes only on first migration application; later manual reclassification is authoritative.
SET @seed_categories := (SELECT COUNT(*)=0 FROM schema_migrations WHERE version='025_recipe_categories');
UPDATE fc_recipes SET category_id='refining' WHERE id='smelt-iron' AND category_id='other' AND @seed_categories=1;
UPDATE fc_recipes SET category_id='tonics' WHERE id='herbal-tonic' AND category_id='other' AND @seed_categories=1;
UPDATE fc_recipes SET category_id='alchemy' WHERE id IN ('veiled-essence','demon-dust') AND category_id='other' AND @seed_categories=1;
UPDATE fc_recipes SET category_id='provisions' WHERE id='trade-crate' AND category_id='other' AND @seed_categories=1;
INSERT INTO schema_migrations(version) VALUES('025_recipe_categories')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
