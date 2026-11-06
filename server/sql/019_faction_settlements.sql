-- Give settlements their own faction-directory category, preserving all existing records.
USE eclipse_order;
ALTER TABLE order_factions MODIFY COLUMN faction_scope ENUM('order_story','world','settlement') NOT NULL DEFAULT 'order_story';
INSERT INTO schema_migrations(version) VALUES('019_faction_settlements')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
