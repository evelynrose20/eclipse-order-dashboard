-- Eclipse Order progression & RP economy extension. Safe to apply repeatedly.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS eo_wallets (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_wallet_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS eo_item_catalog (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 category ENUM('gear','consumable','ration','roleplay') NOT NULL,
 price INT UNSIGNED NOT NULL DEFAULT 0,
 description VARCHAR(500) NOT NULL DEFAULT '',
 min_rank TINYINT UNSIGNED NOT NULL DEFAULT 0,
 active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS eo_inventory (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(character_id,item_id),
 CONSTRAINT fk_inv_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_inv_item FOREIGN KEY(item_id) REFERENCES eo_item_catalog(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS eo_economy_ledger (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 event_type ENUM('opening_grant','paycheck','shop_purchase','ration_claim','adjustment') NOT NULL,
 amount BIGINT NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 description VARCHAR(255) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_economy_character(character_id,id),
 CONSTRAINT fk_ledger_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_ledger_actor FOREIGN KEY(actor_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS eo_paychecks (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 week_start DATE NOT NULL,
 base_amount INT UNSIGNED NOT NULL,
 payout INT UNSIGNED NOT NULL,
 processed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_paycheck_week(character_id,week_start),
 CONSTRAINT fk_paycheck_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_paycheck_actor FOREIGN KEY(processed_by) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS eo_ration_claims (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 claim_date DATE NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 claimed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 PRIMARY KEY(character_id,claim_date),
 CONSTRAINT fk_ration_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_ration_actor FOREIGN KEY(claimed_by) REFERENCES accounts(id) ON DELETE RESTRICT,
 CONSTRAINT fk_ration_item FOREIGN KEY(item_id) REFERENCES eo_item_catalog(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO eo_item_catalog(id,name,category,price,description,min_rank) VALUES
 ('basic_ration','Gruel & Broth','ration',0,'Daily provisions for Rank I',1),
 ('stew_ration','Coerthian Stew & Meats','ration',0,'Daily provisions for Rank II',2),
 ('rice_ration','Doman Rice & Grilled Steaks','ration',0,'Daily provisions for Rank III',3),
 ('feast_ration','VIP Feast & Fine Wine','ration',0,'Daily provisions for Rank IV',4),
 ('iron_collar','Iron Collar (RP prop)','roleplay',2000,'Cosmetic roleplay accessory; never changes OOC consent',0),
 ('padded_collar','Leather Padded Collar','roleplay',5000,'Decorative accessory',0),
 ('velvet_collar','Gold-Chased Velvet Collar','roleplay',25000,'Decorative accessory',0),
 ('tonic','Pearl Lane Tonic','consumable',1500,'Fictional alchemical tonic, no automatic gameplay effect',0),
 ('dagger','Concealed Dagger','gear',12000,'Roleplay equipment; combat effects require GM ruling',0),
 ('freedom_deed','Freedom Deed (RP prop)','roleplay',500000,'A narrative keepsake; does not change character binding or player consent',0)
 ON DUPLICATE KEY UPDATE id=VALUES(id);
INSERT INTO schema_migrations(version) VALUES('006_economy') ON DUPLICATE KEY UPDATE version=VALUES(version);
