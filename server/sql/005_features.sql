-- Eclipse Order MySQL feature tables. Additive, preserves existing accounts and characters.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_profile_preferences (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 adult_declaration BOOLEAN NOT NULL DEFAULT FALSE,
 content_preferences JSON NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_pref_account FOREIGN KEY(user_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_member_rp_profiles (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 display_name VARCHAR(60) NOT NULL DEFAULT '',
 share_content BOOLEAN NOT NULL DEFAULT FALSE,
 share_kinks BOOLEAN NOT NULL DEFAULT FALSE,
 kink_entries JSON NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_rp_account FOREIGN KEY(user_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_settings (
 setting_key VARCHAR(60) PRIMARY KEY,
 content TEXT NOT NULL,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_setting_actor FOREIGN KEY(updated_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_encounters (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 notes TEXT NOT NULL,
 themes JSON NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 status ENUM('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
 turn_index INT UNSIGNED NOT NULL DEFAULT 0,
 round_number INT UNSIGNED NOT NULL DEFAULT 1,
 map_columns INT NOT NULL DEFAULT 16,
 map_rows INT NOT NULL DEFAULT 10,
 map_style ENUM('dungeon','forest','parchment') NOT NULL DEFAULT 'dungeon',
 map_image_url VARCHAR(1200) NULL,
 starts_at DATETIME NULL,
 location VARCHAR(160) NOT NULL DEFAULT '',
 description TEXT NOT NULL,
 capacity INT NOT NULL DEFAULT 8,
 published BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_encounter_creator FOREIGN KEY(created_by) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_combatants (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 encounter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 name VARCHAR(120) NOT NULL,
 kind ENUM('npc','player') NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 initiative INT NOT NULL DEFAULT 0,
 hp INT NOT NULL DEFAULT 20,
 max_hp INT NOT NULL DEFAULT 20,
 ac INT NOT NULL DEFAULT 10,
 conditions JSON NOT NULL,
 tile_x INT NULL,
 tile_y INT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_combatants_encounter(encounter_id),
 CONSTRAINT fk_combatant_enc FOREIGN KEY(encounter_id) REFERENCES order_encounters(id) ON DELETE CASCADE,
 CONSTRAINT fk_combatant_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_monster_templates (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 challenge VARCHAR(40) NOT NULL DEFAULT 'Custom',
 hit_points INT NOT NULL,
 armor_class INT NOT NULL,
 initiative_bonus INT NOT NULL DEFAULT 0,
 actions TEXT NOT NULL,
 notes TEXT NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 CONSTRAINT fk_monster_author FOREIGN KEY(created_by) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_encounter_rolls (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 encounter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 rolled_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 formula VARCHAR(40) NOT NULL,
 rolls JSON NOT NULL,
 total INT NOT NULL,
 visibility ENUM('public','gm_private') NOT NULL DEFAULT 'public',
 kind VARCHAR(35) NOT NULL DEFAULT 'custom',
 target_combatant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 target_dc INT NULL,
 outcome VARCHAR(40) NULL,
 hp_applied BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_rolls_encounter(encounter_id,id),
 CONSTRAINT fk_roll_enc FOREIGN KEY(encounter_id) REFERENCES order_encounters(id) ON DELETE CASCADE,
 CONSTRAINT fk_roll_actor FOREIGN KEY(rolled_by) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_roll_requests (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 encounter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 player_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 label VARCHAR(100) NOT NULL,
 kind VARCHAR(30) NOT NULL DEFAULT 'custom',
 formula VARCHAR(40) NOT NULL,
 dc INT NOT NULL DEFAULT 10,
 state ENUM('pending','resolved','cancelled') NOT NULL DEFAULT 'pending',
 result_roll_id BIGINT UNSIGNED NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_roll_request_enc(encounter_id),
 CONSTRAINT fk_request_enc FOREIGN KEY(encounter_id) REFERENCES order_encounters(id) ON DELETE CASCADE,
 CONSTRAINT fk_request_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_request_player FOREIGN KEY(player_user_id) REFERENCES accounts(id) ON DELETE CASCADE,
 CONSTRAINT fk_request_actor FOREIGN KEY(requested_by) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_encounter_pauses (
 encounter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 paused BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(encounter_id,user_id),
 CONSTRAINT fk_pause_enc FOREIGN KEY(encounter_id) REFERENCES order_encounters(id) ON DELETE CASCADE,
 CONSTRAINT fk_pause_actor FOREIGN KEY(user_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_event_signups (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 encounter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 player_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 status ENUM('requested','approved','declined','withdrawn') NOT NULL DEFAULT 'requested',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_signup_player_event(encounter_id,player_user_id),
 INDEX ix_signups_enc(encounter_id,status),
 CONSTRAINT fk_signup_enc FOREIGN KEY(encounter_id) REFERENCES order_encounters(id) ON DELETE CASCADE,
 CONSTRAINT fk_signup_char FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_signup_player FOREIGN KEY(player_user_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES ('005_features')
ON DUPLICATE KEY UPDATE version=VALUES(version);
