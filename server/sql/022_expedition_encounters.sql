-- Expedition scenario library and individually resolved wilderness encounters.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS fc_expedition_scenarios (
 id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 name VARCHAR(110) NOT NULL,
 kind ENUM('wildlife','bandits','mystery','mature') NOT NULL,
 description VARCHAR(1800) NOT NULL,
 outcome_text VARCHAR(600) NOT NULL DEFAULT '',
 weight TINYINT UNSIGNED NOT NULL DEFAULT 10,
 enemy_health TINYINT UNSIGNED NOT NULL DEFAULT 8,
 enemy_defense TINYINT UNSIGNED NOT NULL DEFAULT 10,
 enabled TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fc_expedition_encounters (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 gathering_run_id BIGINT UNSIGNED NOT NULL UNIQUE,
 scenario_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 status ENUM('active','victory','defeat','retreated','declined','resolved') NOT NULL DEFAULT 'active',
 player_health SMALLINT UNSIGNED NOT NULL DEFAULT 12,
 enemy_health SMALLINT UNSIGNED NOT NULL DEFAULT 8,
 turn_number TINYINT UNSIGNED NOT NULL DEFAULT 0,
 outcome VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME NULL,
 INDEX ix_expedition_encounter_owner(account_id,status),
 CONSTRAINT fk_expedition_encounter_run FOREIGN KEY(gathering_run_id) REFERENCES fc_gathering_runs(id) ON DELETE RESTRICT,
 CONSTRAINT fk_expedition_encounter_scenario FOREIGN KEY(scenario_id) REFERENCES fc_expedition_scenarios(id) ON DELETE RESTRICT,
 CONSTRAINT fk_expedition_encounter_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO fc_expedition_scenarios(id,name,kind,description,outcome_text,weight,enemy_health,enemy_defense,enabled) VALUES
('wild-boar','Territorial Wild Boar','wildlife','A massive boar tears through the undergrowth, defending its feeding ground. You may fight for your gathered supplies or withdraw.','The beast is driven away, and the path opens again.',30,9,10,1),
('forest-bandits','Roadside Raiders','bandits','Armed opportunists step out onto the forest trail, demanding you leave your satchel behind.','The raiders scatter into the trees.',22,12,12,1),
('lost-moon-deer','Moonlit Deer','mystery','A pale deer watches from a moss-covered ruin. A quiet moment may reveal a hidden cache of materials.','The deer vanishes, leaving a clear path to a hidden cache.',18,1,1,1),
('masked-stranger','A Masked Stranger','mature','An enigmatic adult traveler offers an intimate, suggestive roleplay scene. Participation is optional and the scene may fade to black.','The meeting ends privately, and the expedition continues.',8,1,1,1);

INSERT INTO schema_migrations(version) VALUES('022_expedition_encounters')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
