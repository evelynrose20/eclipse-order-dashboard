-- Senate political parties, elections and coalitions.
-- Preview mode exists ONLY in the frontend; this migration creates NO mock
-- parties, election results or Senate appointments.
USE eclipse_order;

CREATE TABLE IF NOT EXISTS order_senate_parties (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 abbreviation VARCHAR(12) NOT NULL,
 manifesto TEXT NOT NULL,
 color CHAR(7) NOT NULL DEFAULT '#A93B46',
 leader_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 state ENUM('active','dissolved') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_senate_party_abbr(abbreviation),
 FOREIGN KEY(leader_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_party_members (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 party_id BIGINT UNSIGNED NOT NULL,
 joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
 FOREIGN KEY(party_id) REFERENCES order_senate_parties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_elections (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(140) NOT NULL,
 phase ENUM('nominations','campaign','voting','confirmation','complete','cancelled') NOT NULL DEFAULT 'nominations',
 term_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 phase_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME NULL,
 KEY ix_senate_elections_phase(phase,id),
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_candidates (
 election_id BIGINT UNSIGNED NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 party_id BIGINT UNSIGNED NULL,
 statement VARCHAR(1500) NOT NULL DEFAULT '',
 nominated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(election_id,account_id),
 FOREIGN KEY(election_id) REFERENCES order_senate_elections(id),
 FOREIGN KEY(account_id) REFERENCES accounts(id),
 FOREIGN KEY(party_id) REFERENCES order_senate_parties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_election_ballots (
 election_id BIGINT UNSIGNED NOT NULL,
 voter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 party_id BIGINT UNSIGNED NULL,
 candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 cast_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(election_id,voter_id),
 FOREIGN KEY(election_id) REFERENCES order_senate_elections(id),
 FOREIGN KEY(voter_id) REFERENCES accounts(id),
 FOREIGN KEY(party_id) REFERENCES order_senate_parties(id),
 FOREIGN KEY(candidate_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_election_results (
 election_id BIGINT UNSIGNED NOT NULL,
 seat_number TINYINT UNSIGNED NOT NULL,
 candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 party_id BIGINT UNSIGNED NULL,
 state ENUM('pending','confirmed','vacant') NOT NULL DEFAULT 'pending',
 confirmed_at DATETIME NULL,
 PRIMARY KEY(election_id,seat_number),
 UNIQUE KEY uq_election_winner(election_id,candidate_id),
 FOREIGN KEY(election_id) REFERENCES order_senate_elections(id),
 FOREIGN KEY(candidate_id) REFERENCES accounts(id),
 FOREIGN KEY(party_id) REFERENCES order_senate_parties(id),
 CONSTRAINT chk_election_seat CHECK(seat_number BETWEEN 1 AND 15)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_election_rejections (
 election_id BIGINT UNSIGNED NOT NULL,
 candidate_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 seat_number TINYINT UNSIGNED NOT NULL,
 reason VARCHAR(500) NOT NULL,
 rejected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(election_id,candidate_id),
 FOREIGN KEY(election_id) REFERENCES order_senate_elections(id),
 FOREIGN KEY(candidate_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_coalitions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(100) NOT NULL,
 agreement TEXT NOT NULL,
 formed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 state ENUM('active','dissolved') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(formed_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_senate_coalition_parties (
 coalition_id BIGINT UNSIGNED NOT NULL,
 party_id BIGINT UNSIGNED NOT NULL,
 status ENUM('invited','accepted') NOT NULL DEFAULT 'invited',
 PRIMARY KEY(coalition_id,party_id),
 FOREIGN KEY(coalition_id) REFERENCES order_senate_coalitions(id),
 FOREIGN KEY(party_id) REFERENCES order_senate_parties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A senator holds a party designation from the completed election. Historical
-- manual appointments remain independent until the first investiture.
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_senate_seats' AND COLUMN_NAME='party_id');
SET @alter_sql := IF(@column_exists=0,
 'ALTER TABLE order_senate_seats ADD COLUMN party_id BIGINT UNSIGNED NULL',
 'SELECT 1');
PREPARE alter_stmt FROM @alter_sql;
EXECUTE alter_stmt;
DEALLOCATE PREPARE alter_stmt;

INSERT INTO schema_migrations(version) VALUES('040_senate_politics')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
