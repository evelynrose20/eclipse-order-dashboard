-- Order-licensed commercial fronts; additive and safe to rerun.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_fronts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(110) NOT NULL,
 category ENUM('tavern','apothecary','workshop','merchant','hospitality','other') NOT NULL,
 location VARCHAR(150) NOT NULL,
 description VARCHAR(1200) NOT NULL DEFAULT '',
 ownership ENUM('order','member') NOT NULL,
 owner_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 license_terms VARCHAR(900) NOT NULL DEFAULT '',
 order_share_percent TINYINT UNSIGNED NOT NULL DEFAULT 30,
 ic_approved TINYINT(1) NOT NULL DEFAULT 0,
 site_approved TINYINT(1) NOT NULL DEFAULT 0,
 status ENUM('pending','active','suspended','closed') NOT NULL DEFAULT 'pending',
 balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX ix_front_status(status,ownership),
 FOREIGN KEY(owner_character_id) REFERENCES characters(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT ck_front_ownership CHECK((ownership='order' AND owner_character_id IS NULL) OR (ownership='member' AND owner_character_id IS NOT NULL)),
 CONSTRAINT ck_front_share CHECK(order_share_percent<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_front_staff (
 front_id BIGINT UNSIGNED NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 staff_role ENUM('manager','employee') NOT NULL DEFAULT 'employee',
 assigned_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(front_id,character_id),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 FOREIGN KEY(character_id) REFERENCES characters(id),
 FOREIGN KEY(assigned_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_front_offerings (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 front_id BIGINT UNSIGNED NOT NULL,
 offer_type ENUM('goods','service') NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 name VARCHAR(120) NOT NULL,
 description VARCHAR(500) NOT NULL DEFAULT '',
 posted_price INT UNSIGNED NOT NULL DEFAULT 0,
 restricted TINYINT(1) NOT NULL DEFAULT 0,
 is_active TINYINT(1) NOT NULL DEFAULT 1,
 FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id),
 CONSTRAINT ck_front_offer_kind CHECK((offer_type='goods' AND material_id IS NOT NULL) OR (offer_type='service' AND material_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_front_stock (
 front_id BIGINT UNSIGNED NOT NULL,
 material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity INT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(front_id,material_id),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 FOREIGN KEY(material_id) REFERENCES fc_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_front_ledger (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 front_id BIGINT UNSIGNED NOT NULL,
 kind ENUM('trade_income','operating_expense') NOT NULL,
 gross_amount INT UNSIGNED NOT NULL DEFAULT 0,
 amount INT UNSIGNED NOT NULL,
 balance_after BIGINT UNSIGNED NOT NULL,
 source_delivery_id BIGINT UNSIGNED NULL,
 description VARCHAR(250) NOT NULL DEFAULT '',
 by_account CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_front_delivery(source_delivery_id),
 INDEX ix_front_history(front_id,id),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 FOREIGN KEY(source_delivery_id) REFERENCES fc_trade_deliveries(id),
 FOREIGN KEY(by_account) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_front_change_requests (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 front_id BIGINT UNSIGNED NOT NULL,
 request_type ENUM('location','category','expansion','restricted_service') NOT NULL,
 requested_value VARCHAR(400) NOT NULL,
 justification VARCHAR(900) NOT NULL DEFAULT '',
 state ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at DATETIME NULL,
 INDEX ix_front_changes(front_id,state),
 FOREIGN KEY(front_id) REFERENCES order_fronts(id),
 FOREIGN KEY(requested_by) REFERENCES accounts(id),
 FOREIGN KEY(reviewed_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @has_front_delivery := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_trade_deliveries' AND COLUMN_NAME='front_id');
SET @front_delivery_sql := IF(@has_front_delivery=0,'ALTER TABLE fc_trade_deliveries ADD COLUMN front_id BIGINT UNSIGNED NULL','SELECT 1');
PREPARE front_stmt FROM @front_delivery_sql; EXECUTE front_stmt; DEALLOCATE PREPARE front_stmt;
ALTER TABLE order_treasury_ledger MODIFY COLUMN category ENUM('trade','daily_pay','mission','front_share') NOT NULL;
ALTER TABLE fc_material_ledger MODIFY COLUMN activity ENUM('gather','harvest','craft_input','craft_output','upgrade','trade','front_transfer','front_return') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('028_order_fronts')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
