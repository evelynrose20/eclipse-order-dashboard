-- Private, player-controlled IC cycle and pregnancy records. Never inferred from collar status alone.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS character_reproductive_profiles (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 cycle_opt_in TINYINT(1) NOT NULL DEFAULT 0,
 conception_opt_in TINYINT(1) NOT NULL DEFAULT 0,
 cycle_type ENUM('heat','rut') NOT NULL DEFAULT 'heat',
 cycle_anchor DATE NULL,
 cycle_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
 base_chance TINYINT UNSIGNED NOT NULL DEFAULT 20,
 pregnancy_status ENUM('none','active','completed','ended') NOT NULL DEFAULT 'none',
 pregnancy_anchor DATE NULL,
 pregnancy_start_day SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 pregnancy_total_days SMALLINT UNSIGNED NOT NULL DEFAULT 280,
 pregnancy_notes VARCHAR(1500) NOT NULL DEFAULT '',
 shared_with_command TINYINT(1) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT chk_cycle_days CHECK(cycle_days BETWEEN 20 AND 90),
 CONSTRAINT chk_base_chance CHECK(base_chance<=100),
 CONSTRAINT chk_pregnancy_term CHECK(pregnancy_total_days BETWEEN 20 AND 600)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS character_conception_rolls (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 event_key CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 actor_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 ic_event_date DATE NOT NULL,
 roll_d100 TINYINT UNSIGNED NOT NULL,
 chance TINYINT UNSIGNED NOT NULL,
 success TINYINT(1) NOT NULL,
 rank_code VARCHAR(40) NULL,
 cycle_phase VARCHAR(20) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_character_conception_event(character_id,event_key),
 UNIQUE KEY uq_character_conception_day(character_id,ic_event_date),
 FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
 FOREIGN KEY (actor_account_id) REFERENCES accounts(id),
 CONSTRAINT chk_conception_roll CHECK(roll_d100 BETWEEN 1 AND 100 AND chance<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS character_reproductive_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 actor_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action VARCHAR(40) NOT NULL,
 summary VARCHAR(180) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_reproductive_event_history(character_id,created_at),
 FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
 FOREIGN KEY (actor_account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('114_character_cycles_and_pregnancy')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
