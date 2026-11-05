-- Optional manual migration for MySQL 8.0 / MariaDB when not using npm run setup:local.
-- The recommended installer is npm run setup:local, which checks schema before ALTER TABLE.
-- This file documents the additional column but is NOT intended to be executed directly
-- against a database where approval_status already exists.
USE eclipse_order;
ALTER TABLE accounts ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved';
CREATE INDEX ix_accounts_approval ON accounts(approval_status,created_at);
INSERT INTO schema_migrations(version) VALUES('004_registration')
ON DUPLICATE KEY UPDATE version=VALUES(version);
