-- Live Council and editable charter. No demonstration records are inserted.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_governance_charter (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 title VARCHAR(160) NOT NULL DEFAULT 'Eclipse Order Charter',
 charter_text TEXT NOT NULL,
 quorum TINYINT UNSIGNED NOT NULL DEFAULT 3,
 major_yes TINYINT UNSIGNED NOT NULL DEFAULT 4,
 ratification_days SMALLINT UNSIGNED NOT NULL DEFAULT 7,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(updated_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_governance_charter(id,title,charter_text,quorum,major_yes,ratification_days) VALUES
 (1,'Eclipse Order Charter','The Domina presides over five permanent Council offices. She appoints or removes officers. Ordinary Council decisions require quorum and more affirmative than opposing votes. Major matters require the charter major threshold. Reserved matters also require explicit Domina ratification. Empty Council seats do not lower these thresholds. In-character rulings cannot change real account roles, OOC consent, moderation, security, financial balances or gameplay permissions.',3,4,7);
CREATE TABLE IF NOT EXISTS order_governance_charter_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 revision INT UNSIGNED NOT NULL,
 title VARCHAR(160) NOT NULL,
 charter_text TEXT NOT NULL,
 quorum TINYINT UNSIGNED NOT NULL,
 major_yes TINYINT UNSIGNED NOT NULL,
 ratification_days SMALLINT UNSIGNED NOT NULL,
 changed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_charter_revision(revision),
 FOREIGN KEY(changed_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_council_offices (
 code VARCHAR(32) NOT NULL PRIMARY KEY,
 title VARCHAR(100) NOT NULL,
 department VARCHAR(180) NOT NULL,
 seat_number TINYINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 appointed_at DATETIME NULL,
 UNIQUE KEY uq_council_seat(seat_number),
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_council_offices(code,title,department,seat_number) VALUES
 ('domina','Domina','Council chair and reserved ratification',1),
 ('operations','Chief of Operations','Missions and strategic operations',2),
 ('commerce','Master of Commerce','Enterprises and front licenses',3),
 ('faction','Faction Envoy','External relations and diplomacy',4),
 ('internal','Prefect of Internal Affairs','Recruitment and internal governance',5);
CREATE TABLE IF NOT EXISTS order_council_motions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(160) NOT NULL,
 detail TEXT NOT NULL,
 kind ENUM('ordinary','major','reserved') NOT NULL,
 state ENUM('draft','open','passed','rejected','awaiting_ratification','ratified','returned','withdrawn') NOT NULL DEFAULT 'draft',
 sponsor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quorum_required TINYINT UNSIGNED NOT NULL DEFAULT 3,
 major_yes_required TINYINT UNSIGNED NOT NULL DEFAULT 4,
 ratification_days SMALLINT UNSIGNED NOT NULL DEFAULT 7,
 opened_at DATETIME NULL,
 closed_at DATETIME NULL,
 ratification_deadline DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_council_motion_state(state,id),
 FOREIGN KEY(sponsor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_council_electorate (
 motion_id BIGINT UNSIGNED NOT NULL,
 office_code VARCHAR(32) NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 PRIMARY KEY(motion_id,office_code),
 UNIQUE KEY uq_council_voter(motion_id,account_id),
 FOREIGN KEY(motion_id) REFERENCES order_council_motions(id),
 FOREIGN KEY(office_code) REFERENCES order_council_offices(code),
 FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_council_votes (
 motion_id BIGINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 vote ENUM('yes','no','abstain') NOT NULL,
 cast_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(motion_id,account_id),
 FOREIGN KEY(motion_id) REFERENCES order_council_motions(id),
 FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_governance_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action VARCHAR(48) NOT NULL,
 subject VARCHAR(96) NOT NULL,
 details VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_governance_audit(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('034_live_governance') ON DUPLICATE KEY UPDATE version=VALUES(version);
