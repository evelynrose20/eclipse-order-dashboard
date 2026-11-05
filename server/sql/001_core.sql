-- Eclipse Order local Windows MySQL/MariaDB schema v1
-- Run through HeidiSQL using an administrator account, NOT the restricted eclipse_api account.
-- Requires pre-created eclipse_order database. No existing tables are dropped.
-- Not a Supabase migration; this creates EMPTY local tables.
-- No accounts or characters are imported, and no password hashes are copied.
USE eclipse_order;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(60) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NOT NULL DEFAULT '',
  account_role ENUM('domina','high_command','handler','member') NOT NULL DEFAULT 'member',
  standing ENUM('initiate','associate','established','veteran') NOT NULL DEFAULT 'initiate',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_accounts_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS characters (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
  character_name VARCHAR(120) NOT NULL,
  player_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  handler_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  collar_bound TINYINT(1) NOT NULL DEFAULT 0,
  bound_rank ENUM('rank_i','rank_ii','rank_iii','rank_iv') NULL,
  sheet_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_characters_player (player_account_id),
  KEY ix_characters_handler (handler_account_id),
  CONSTRAINT fk_characters_player FOREIGN KEY (player_account_id)
    REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT fk_characters_handler FOREIGN KEY (handler_account_id)
    REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_bound_rank_consistent CHECK (
    (collar_bound = 0 AND bound_rank IS NULL) OR
    (collar_bound = 1 AND bound_rank IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS character_status_requests (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
  character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  player_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  target_bound TINYINT(1) NOT NULL,
  state ENUM('pending','approved','declined','cancelled','applied') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL DEFAULT NULL,
  applied_at TIMESTAMP NULL DEFAULT NULL,
  KEY ix_status_request_character (character_id,state),
  KEY ix_status_request_player (player_account_id,state),
  CONSTRAINT fk_status_request_character FOREIGN KEY (character_id)
    REFERENCES characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_status_request_player FOREIGN KEY (player_account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_status_request_actor FOREIGN KEY (requested_by)
    REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(70) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  details_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_entity (entity_type,entity_id),
  KEY ix_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_account_id)
    REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('001_core')
ON DUPLICATE KEY UPDATE version=VALUES(version);

-- Verify with:
-- SELECT version, applied_at FROM schema_migrations;
-- SHOW TABLES;
