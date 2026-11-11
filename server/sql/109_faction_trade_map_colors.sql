-- Faction trade eligibility and political map color, preserving existing diplomacy records.
USE eclipse_order;
SET @faction_trade_first_install := (SELECT COUNT(*)=0 FROM schema_migrations WHERE version='109_faction_trade_map_colors');
SET @has_trade := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_factions' AND COLUMN_NAME='trade_enabled');
SET @stmt := IF(@has_trade=0,'ALTER TABLE order_factions ADD COLUMN trade_enabled TINYINT(1) NOT NULL DEFAULT 1','SELECT 1');
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_color := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_factions' AND COLUMN_NAME='map_color');
SET @stmt := IF(@has_color=0,"ALTER TABLE order_factions ADD COLUMN map_color CHAR(7) CHARACTER SET ascii COLLATE ascii_general_ci NULL","SELECT 1");
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- Existing hostile factions start closed on first installation, but later manual overrides survive setup reruns.
UPDATE order_factions SET trade_enabled=0 WHERE relationship='hostile' AND @faction_trade_first_install=1;
UPDATE fc_trade_contracts c JOIN order_factions f ON f.id=c.faction_id SET c.status='paused'
 WHERE f.trade_enabled=0 AND c.status='open' AND @faction_trade_first_install=1;
INSERT INTO schema_migrations(version) VALUES('109_faction_trade_map_colors')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
