-- Discord identity is linked to existing Eclipse Order accounts explicitly.
-- No account is created by Discord and Discord email is never used as an ownership key.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS account_discord_links (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 discord_user_id VARCHAR(25) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 discord_username VARCHAR(100) NOT NULL,
 linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_discord_user (discord_user_id),
 CONSTRAINT fk_discord_link_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discord_oauth_states (
 state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 target_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 expires_at DATETIME NOT NULL,
 consumed_at DATETIME NULL,
 KEY ix_oauth_state_expiry(expires_at),
 CONSTRAINT fk_oauth_state_target FOREIGN KEY(target_account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discord_oauth_tickets (
 ticket_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 discord_user_id VARCHAR(25) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 discord_username VARCHAR(100) NOT NULL,
 intent ENUM('login','link') NOT NULL,
 expires_at DATETIME NOT NULL,
 redeemed_at DATETIME NULL,
 KEY ix_oauth_ticket_expiry(expires_at),
 CONSTRAINT fk_oauth_ticket_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations(version) VALUES('014_discord_oauth') ON DUPLICATE KEY UPDATE version=VALUES(version);
