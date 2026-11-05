-- Registration requests are disabled by default until a Domina approves them.
USE eclipse_order;
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved';
CREATE INDEX IF NOT EXISTS ix_accounts_approval ON accounts (approval_status,created_at);
INSERT INTO schema_migrations(version) VALUES ('004_registration')
ON DUPLICATE KEY UPDATE version=VALUES(version);
