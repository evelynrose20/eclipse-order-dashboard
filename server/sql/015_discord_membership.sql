-- Extend Discord OAuth to distinguish normal sign-in from an expressly requested server join.
USE eclipse_order;
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='discord_oauth_states' AND COLUMN_NAME='intent');
SET @statement := IF(@column_exists=0,"ALTER TABLE discord_oauth_states ADD COLUMN intent ENUM('login','join') NOT NULL DEFAULT 'login'","SELECT 'Discord intent already present' AS status");
PREPARE add_discord_intent FROM @statement;
EXECUTE add_discord_intent;
DEALLOCATE PREPARE add_discord_intent;
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='discord_oauth_states' AND COLUMN_NAME='adult_confirmed');
SET @statement := IF(@column_exists=0,"ALTER TABLE discord_oauth_states ADD COLUMN adult_confirmed TINYINT(1) NOT NULL DEFAULT 0","SELECT 'Discord adult acknowledgement already present' AS status");
PREPARE add_discord_adult FROM @statement;
EXECUTE add_discord_adult;
DEALLOCATE PREPARE add_discord_adult;
INSERT INTO schema_migrations(version) VALUES('015_discord_membership') ON DUPLICATE KEY UPDATE version=VALUES(version);
