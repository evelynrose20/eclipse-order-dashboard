-- Character-attributed batch tanks and transactional workshop stock transfers.
-- Safe to rerun through npm run setup:local; previous batch quantities are retained.
USE eclipse_order;
SET @eo_119_a := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber ADD COLUMN upper_source_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME='upper_source_character_id');
PREPARE eo119a FROM @eo_119_a; EXECUTE eo119a; DEALLOCATE PREPARE eo119a;
SET @eo_119_b := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber ADD COLUMN lower_source_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME='lower_source_character_id');
PREPARE eo119b FROM @eo_119_b; EXECUTE eo119b; DEALLOCATE PREPARE eo119b;
SET @eo_119_c := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber_batches ADD COLUMN source_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber_batches' AND COLUMN_NAME='source_character_id');
PREPARE eo119c FROM @eo_119_c; EXECUTE eo119c; DEALLOCATE PREPARE eo119c;
SET @eo_119_d := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber_batches ADD COLUMN source_name VARCHAR(120) NULL', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber_batches' AND COLUMN_NAME='source_name');
PREPARE eo119d FROM @eo_119_d; EXECUTE eo119d; DEALLOCATE PREPARE eo119d;
SET @eo_119_e := (SELECT IF(COUNT(*)=0, 'ALTER TABLE order_thrall_chamber_batches ADD COLUMN drained_total DECIMAL(10,1) UNSIGNED NOT NULL DEFAULT 0.0', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_thrall_chamber_batches' AND COLUMN_NAME='drained_total');
PREPARE eo119e FROM @eo_119_e; EXECUTE eo119e; DEALLOCATE PREPARE eo119e;
CREATE TABLE IF NOT EXISTS order_thrall_batch_transfers (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 batch_id BIGINT UNSIGNED NOT NULL,
 source_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_thrall_batch_transfer_batch(batch_id),
 CONSTRAINT fk_thrall_batch_transfer_batch FOREIGN KEY(batch_id) REFERENCES order_thrall_chamber_batches(id),
 CONSTRAINT fk_thrall_batch_transfer_material FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT fk_thrall_batch_transfer_actor FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE fc_material_ledger MODIFY activity ENUM('gather','harvest','craft_input','craft_output','upgrade','chamber_transfer') NOT NULL;
INSERT IGNORE INTO fc_materials(id,name,category,description) VALUES
 ('chamber-breast-milk','Breast Milk','supply','Fictional lacteal reagent transferred from character-attributed chamber tanks'),
 ('chamber-secondary-fluid','Secondary Chamber Fluid','supply','Fictional secondary reagent transferred from character-attributed chamber tanks'),
 ('demon-dust','Demon Dust','supply','A fictional Eclipse Order alchemical RP product');
INSERT IGNORE INTO fc_recipes(id,name,description,output_material,output_quantity) VALUES
 ('demon-dust','Prepare Demon Dust','Fictional Eclipse Order alchemical recipe with chamber reagents','demon-dust',1);
INSERT IGNORE INTO fc_recipe_inputs(recipe_id,material_id,quantity) VALUES
 ('demon-dust','chamber-breast-milk',1),
 ('demon-dust','chamber-secondary-fluid',1);
-- New Demon Dust recipes belong in the alchemy category when workshop categories exist.
SET @eo_119_cat := (SELECT IF(COUNT(*)>0, "UPDATE fc_recipes SET category_id='alchemy' WHERE id='demon-dust' AND category_id='other'", "DO 0") FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_recipes' AND COLUMN_NAME='category_id');
PREPARE eo119cat FROM @eo_119_cat; EXECUTE eo119cat; DEALLOCATE PREPARE eo119cat;
INSERT INTO schema_migrations(version) VALUES('119_chamber_batch_tanks_workshop') ON DUPLICATE KEY UPDATE version=VALUES(version);
