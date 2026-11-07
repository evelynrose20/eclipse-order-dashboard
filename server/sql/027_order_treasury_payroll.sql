-- Fictional in-character Order treasury; all balances are integers, never real-world money.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_treasury (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
INSERT IGNORE INTO order_treasury(id,balance) VALUES(1,0);
CREATE TABLE IF NOT EXISTS order_payroll_settings (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 member_daily INT UNSIGNED NOT NULL DEFAULT 5,
 bound_daily INT UNSIGNED NOT NULL DEFAULT 1,
 reset_hour_utc TINYINT UNSIGNED NOT NULL DEFAULT 15,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 CONSTRAINT ck_pay_hour CHECK(reset_hour_utc BETWEEN 0 AND 23),
 CONSTRAINT ck_pay_amount CHECK(member_daily<=10000 AND bound_daily<=10000 AND bound_daily<=member_daily)
) ENGINE=InnoDB;
INSERT IGNORE INTO order_payroll_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS character_wallets (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_wallet_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_payroll_runs (
 cycle_date DATE NOT NULL PRIMARY KEY,
 run_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 available_before BIGINT UNSIGNED NOT NULL DEFAULT 0,
 requested_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
 paid_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
 recipients INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_treasury_ledger (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 direction ENUM('income','expense') NOT NULL,
 category ENUM('trade','daily_pay','mission') NOT NULL,
 amount BIGINT UNSIGNED NOT NULL,
 balance_after BIGINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 source_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 note VARCHAR(250) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_treasury_source(category,source_id),
 INDEX ix_treasury_recent(id),
 CONSTRAINT fk_treasury_account FOREIGN KEY(account_id) REFERENCES accounts(id),
 CONSTRAINT fk_treasury_character FOREIGN KEY(character_id) REFERENCES characters(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS character_wallet_ledger (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 kind ENUM('daily_pay','mission') NOT NULL,
 amount INT UNSIGNED NOT NULL,
 balance_after BIGINT UNSIGNED NOT NULL,
 source_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_wallet_source(character_id,kind,source_id),
 INDEX ix_wallet_history(character_id,id),
 CONSTRAINT fk_wallet_entry_character FOREIGN KEY(character_id) REFERENCES characters(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_daily_payroll (
 cycle_date DATE NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 owner_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 pay_class ENUM('member','bound') NOT NULL,
 scheduled_amount INT UNSIGNED NOT NULL,
 paid_amount INT UNSIGNED NOT NULL,
 PRIMARY KEY(cycle_date,character_id),
 CONSTRAINT fk_payroll_character FOREIGN KEY(character_id) REFERENCES characters(id),
 CONSTRAINT fk_payroll_account FOREIGN KEY(owner_account_id) REFERENCES accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_mission_payments (
 event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 amount INT UNSIGNED NOT NULL,
 granted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(event_id,character_id),
 CONSTRAINT fk_mission_pay_event FOREIGN KEY(event_id) REFERENCES order_encounters(id),
 CONSTRAINT fk_mission_pay_character FOREIGN KEY(character_id) REFERENCES characters(id),
 CONSTRAINT fk_mission_pay_author FOREIGN KEY(granted_by) REFERENCES accounts(id)
) ENGINE=InnoDB;
SET @has_sale_rate := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fc_trade_contracts' AND COLUMN_NAME='sale_value_per_unit');
SET @sale_ddl := IF(@has_sale_rate=0,'ALTER TABLE fc_trade_contracts ADD COLUMN sale_value_per_unit INT UNSIGNED NOT NULL DEFAULT 0','SELECT 1');
PREPARE sale_stmt FROM @sale_ddl; EXECUTE sale_stmt; DEALLOCATE PREPARE sale_stmt;
-- Existing contracts have a zero sale rate; no retroactive income is invented.
INSERT INTO schema_migrations(version) VALUES('027_order_treasury_payroll')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
