-- Eclipse Order official syndicate hierarchy, separate from account permissions and fictional binding ranks.
-- Additive and safe to run multiple times. Existing account roles and sessions are untouched.
USE eclipse_order;
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='accounts' AND COLUMN_NAME='syndicate_rank');
SET @migration := IF(@exists=0,
 "ALTER TABLE accounts ADD COLUMN syndicate_rank ENUM('domina','oyabun','kusushi','operative','kumi_in') NOT NULL DEFAULT 'kumi_in'",
 "SELECT 'syndicate_rank already present' AS status");
PREPARE stmt FROM @migration;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Domina is the established leader. Other existing accounts retain recruit rank
-- until deliberately assigned an Order rank by Domina.
UPDATE accounts SET syndicate_rank='domina' WHERE account_role='domina' AND syndicate_rank='kumi_in';
INSERT INTO schema_migrations(version) VALUES('007_syndicate_ranks')
ON DUPLICATE KEY UPDATE version=VALUES(version);
