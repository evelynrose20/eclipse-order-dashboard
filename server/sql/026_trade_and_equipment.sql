-- Shared FC trade routes, character-crafted equipment and item ownership.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS fc_equipment_templates (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 name VARCHAR(110) NOT NULL,
 description VARCHAR(600) NOT NULL DEFAULT '',
 slot ENUM('weapon','armor','tool','accessory') NOT NULL,
 minimum_level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 attack_bonus SMALLINT NOT NULL DEFAULT 0,
 defense_bonus SMALLINT NOT NULL DEFAULT 0,
 tool_bonus SMALLINT NOT NULL DEFAULT 0,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 CONSTRAINT ck_equipment_min_level CHECK(minimum_level BETWEEN 1 AND 100),
 CONSTRAINT ck_equipment_bonuses CHECK(attack_bonus BETWEEN 0 AND 20 AND defense_bonus BETWEEN 0 AND 20 AND tool_bonus BETWEEN 0 AND 20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS fc_equipment_ingredients (
 template_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 PRIMARY KEY(template_id,material_id),
 CONSTRAINT fk_gear_input_template FOREIGN KEY(template_id) REFERENCES fc_equipment_templates(id) ON DELETE CASCADE,
 CONSTRAINT fk_gear_input_material FOREIGN KEY(material_id) REFERENCES fc_materials(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS character_equipment_items (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 template_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 crafted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 status ENUM('owned','traded') NOT NULL DEFAULT 'owned',
 equipped TINYINT(1) NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_gear_character(character_id,status),
 CONSTRAINT fk_gear_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE RESTRICT,
 CONSTRAINT fk_gear_template FOREIGN KEY(template_id) REFERENCES fc_equipment_templates(id) ON DELETE RESTRICT,
 CONSTRAINT fk_gear_crafter FOREIGN KEY(crafted_by) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS fc_trade_contracts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 title VARCHAR(130) NOT NULL,
 description VARCHAR(600) NOT NULL DEFAULT '',
 item_kind ENUM('material','equipment') NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 equipment_template_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 required_quantity INT UNSIGNED NOT NULL,
 delivered_quantity INT UNSIGNED NOT NULL DEFAULT 0,
 rep_per_unit TINYINT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('open','paused','complete') NOT NULL DEFAULT 'open',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_trade_faction(faction_id,status),
 CONSTRAINT fk_trade_faction FOREIGN KEY(faction_id) REFERENCES order_factions(id) ON DELETE RESTRICT,
 CONSTRAINT fk_trade_material FOREIGN KEY(material_id) REFERENCES fc_materials(id) ON DELETE RESTRICT,
 CONSTRAINT fk_trade_equipment FOREIGN KEY(equipment_template_id) REFERENCES fc_equipment_templates(id) ON DELETE RESTRICT,
 CONSTRAINT fk_trade_author FOREIGN KEY(created_by) REFERENCES accounts(id) ON DELETE RESTRICT,
 CONSTRAINT ck_trade_item CHECK ((item_kind='material' AND material_id IS NOT NULL AND equipment_template_id IS NULL) OR (item_kind='equipment' AND equipment_template_id IS NOT NULL AND material_id IS NULL)),
 CONSTRAINT ck_trade_quantities CHECK(required_quantity>0 AND delivered_quantity<=required_quantity),
 CONSTRAINT ck_trade_rep CHECK(rep_per_unit BETWEEN 1 AND 20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS fc_trade_deliveries (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 contract_id BIGINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 equipment_item_id BIGINT UNSIGNED NULL,
 quantity INT UNSIGNED NOT NULL,
 reputation_change SMALLINT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_deliveries_contract(contract_id,id),
 CONSTRAINT fk_delivery_contract FOREIGN KEY(contract_id) REFERENCES fc_trade_contracts(id),
 CONSTRAINT fk_delivery_account FOREIGN KEY(account_id) REFERENCES accounts(id),
 CONSTRAINT fk_delivery_character FOREIGN KEY(character_id) REFERENCES characters(id),
 CONSTRAINT fk_delivery_item FOREIGN KEY(equipment_item_id) REFERENCES character_equipment_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO fc_equipment_templates(id,name,description,slot,minimum_level,attack_bonus,defense_bonus,tool_bonus) VALUES
 ('iron-sabre','Iron Sabre','A basic blade forged for patrols and foreign contracts.','weapon',3,1,0,0),
 ('iron-vest','Ironwork Vest','Protective clothing fitted with light metal plates.','armor',3,0,1,0),
 ('field-pick','Field Mining Pick','A sturdy pick suitable for settlement mining crews.','tool',2,0,0,1);
INSERT IGNORE INTO fc_equipment_ingredients(template_id,material_id,quantity) VALUES
 ('iron-sabre','iron-ingot',2),('iron-vest','iron-ingot',3),('field-pick','iron-ingot',1);
INSERT INTO schema_migrations(version) VALUES('026_trade_and_equipment')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
