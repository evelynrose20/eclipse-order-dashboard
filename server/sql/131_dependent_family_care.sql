USE eclipse_order;
-- Children/dependents are entirely separate from adult character sheets and servitude systems.
CREATE TABLE IF NOT EXISTS order_dependents (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 guardian_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 name VARCHAR(120) NOT NULL,
 birth_date DATE NULL,
 stage ENUM('newborn','infant','toddler','child') NOT NULL DEFAULT 'newborn',
 lineage_case_id BIGINT UNSIGNED NULL,
 milk_stock INT UNSIGNED NOT NULL DEFAULT 0,
 food_stock INT UNSIGNED NOT NULL DEFAULT 0,
 notes VARCHAR(1000) NOT NULL DEFAULT '',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_guardian (guardian_account_id),
 FOREIGN KEY (guardian_account_id) REFERENCES accounts(id),
 FOREIGN KEY (lineage_case_id) REFERENCES order_lineage_cases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_dependent_caregivers (
 dependent_id BIGINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(dependent_id,account_id),
 FOREIGN KEY(dependent_id) REFERENCES order_dependents(id) ON DELETE CASCADE,
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_caregiver_settings (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 nursing_available TINYINT(1) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_dependent_care_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 dependent_id BIGINT UNSIGNED NOT NULL,
 actor_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action ENUM('nursing','bottle','meal','comfort','restock_milk','restock_food') NOT NULL,
 quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 detail VARCHAR(250) NOT NULL DEFAULT '',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_dependent_events(dependent_id,created_at),
 FOREIGN KEY(dependent_id) REFERENCES order_dependents(id) ON DELETE CASCADE,
 FOREIGN KEY(actor_account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('131_dependent_family_care')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
