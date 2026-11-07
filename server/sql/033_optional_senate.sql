-- Optional in-character Senate. Disabled until explicitly activated by the Domina.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_senate_settings (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 enabled TINYINT(1) NOT NULL DEFAULT 0,
 quorum_percent TINYINT UNSIGNED NOT NULL DEFAULT 50,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(updated_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_senate_settings(id,enabled,quorum_percent) VALUES(1,0,50);
CREATE TABLE IF NOT EXISTS order_senators (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 appointed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 removed_at DATETIME NULL,
 FOREIGN KEY(account_id) REFERENCES accounts(id),
 FOREIGN KEY(appointed_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_senate_bills (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(160) NOT NULL,
 description TEXT NOT NULL,
 category VARCHAR(50) NOT NULL DEFAULT 'general',
 sponsor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 state ENUM('draft','open','passed','rejected','withdrawn') NOT NULL DEFAULT 'draft',
 electorate INT UNSIGNED NOT NULL DEFAULT 0,
 quorum_required INT UNSIGNED NOT NULL DEFAULT 0,
 opened_at DATETIME NULL,
 closed_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_senate_bills(state,id),
 FOREIGN KEY(sponsor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_senate_ballots (
 bill_id BIGINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 vote ENUM('yes','no','abstain') NOT NULL,
 cast_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(bill_id,account_id),
 FOREIGN KEY(bill_id) REFERENCES order_senate_bills(id),
 FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_senate_electorate (
 bill_id BIGINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 PRIMARY KEY(bill_id,account_id),
 FOREIGN KEY(bill_id) REFERENCES order_senate_bills(id),
 FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_senate_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action VARCHAR(45) NOT NULL,
 subject VARCHAR(90) NOT NULL,
 detail VARCHAR(350) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY ix_senate_audit(id),
 FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('033_optional_senate') ON DUPLICATE KEY UPDATE version=VALUES(version);
