-- Eclipse Order local MySQL schema v2: revocable account sessions.
-- Run in HeidiSQL with a database administrator, after 001_core.sql.
-- Do not use the restricted eclipse_api user for DDL.
USE eclipse_order;

CREATE TABLE IF NOT EXISTS account_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  UNIQUE KEY uq_session_hash (token_hash),
  KEY ix_sessions_account (account_id, expires_at),
  CONSTRAINT fk_sessions_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations(version) VALUES ('002_sessions')
ON DUPLICATE KEY UPDATE version=VALUES(version);

-- Verify:
-- SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;
-- SHOW TABLES;
