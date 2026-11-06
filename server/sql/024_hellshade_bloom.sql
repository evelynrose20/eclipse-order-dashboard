-- Fictional Eclipse Order botanical and alchemical resource.
-- Existing garden plots and their progress are preserved. A new plot can be planted after an upgrade.
USE eclipse_order;
INSERT IGNORE INTO fc_materials(id,name,category,description) VALUES
 ('hellshade-bloom','Hellshade Bloom','botanical','A rare black-violet fantasy flower with ember-red veins. Its petals glow under an eclipsed moon.'),
 ('demon-dust','Demon Dust','supply','A wholly fictional occult trade reagent of the Eclipse Order, used only in RP stories and contracts.');
INSERT IGNORE INTO fc_recipes(id,name,description,output_material,output_quantity,minimum_level) VALUES
 ('demon-dust','Prepare Demon Dust','An abstract in-world alchemical rite producing a fictional occult powder; no real-world instructions.','demon-dust',1,12);
INSERT IGNORE INTO fc_recipe_inputs(recipe_id,material_id,quantity) VALUES
 ('demon-dust','hellshade-bloom',2),
 ('demon-dust','moonstone',1);
INSERT INTO schema_migrations(version) VALUES('024_hellshade_bloom')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
