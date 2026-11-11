-- Negotiated trade windows: NPC factions can accept, refuse or counter an offer.
USE eclipse_order;
ALTER TABLE world_logistics_trade_treaties MODIFY COLUMN status ENUM('proposed','approved','active','suspended','retired','rejected','countered','expired') NOT NULL DEFAULT 'proposed';
SET @c=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_trade_treaties' AND COLUMN_NAME='starts_at');
SET @q=IF(@c=0,'ALTER TABLE world_logistics_trade_treaties ADD COLUMN starts_at DATETIME NULL','SELECT 1');
PREPARE m FROM @q;EXECUTE m;DEALLOCATE PREPARE m;
SET @c=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_trade_treaties' AND COLUMN_NAME='ends_at');
SET @q=IF(@c=0,'ALTER TABLE world_logistics_trade_treaties ADD COLUMN ends_at DATETIME NULL','SELECT 1');
PREPARE m FROM @q;EXECUTE m;DEALLOCATE PREPARE m;
SET @c=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_trade_treaties' AND COLUMN_NAME='response_due_at');
SET @q=IF(@c=0,'ALTER TABLE world_logistics_trade_treaties ADD COLUMN response_due_at DATETIME NULL','SELECT 1');
PREPARE m FROM @q;EXECUTE m;DEALLOCATE PREPARE m;
SET @c=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_trade_treaties' AND COLUMN_NAME='responded_at');
SET @q=IF(@c=0,'ALTER TABLE world_logistics_trade_treaties ADD COLUMN responded_at DATETIME NULL','SELECT 1');
PREPARE m FROM @q;EXECUTE m;DEALLOCATE PREPARE m;
SET @c=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_logistics_trade_treaties' AND COLUMN_NAME='response_reason');
SET @q=IF(@c=0,"ALTER TABLE world_logistics_trade_treaties ADD COLUMN response_reason VARCHAR(300) NOT NULL DEFAULT ''",'SELECT 1');
PREPARE m FROM @q;EXECUTE m;DEALLOCATE PREPARE m;
CREATE INDEX IF NOT EXISTS ix_trade_negotiation_due ON world_logistics_trade_treaties(status,response_due_at);
INSERT INTO schema_migrations(version) VALUES('106_timed_trade_negotiations')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
