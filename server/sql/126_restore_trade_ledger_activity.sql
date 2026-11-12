-- Chamber, trade and front logistics all write to the same materials ledger.
-- Earlier ENUM migrations accidentally removed each other's activity values.
-- Keep previous entries and allow additional server-validated activity types.
USE eclipse_order;
ALTER TABLE fc_material_ledger MODIFY COLUMN activity VARCHAR(45) NOT NULL;
INSERT INTO schema_migrations(version) VALUES('126_restore_trade_ledger_activity')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
