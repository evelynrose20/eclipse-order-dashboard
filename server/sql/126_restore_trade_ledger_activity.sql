-- The chamber materials migration added chamber_transfer but accidentally
-- removed the existing trade activity. Keep both valid ledger actions.
USE eclipse_order;
ALTER TABLE fc_material_ledger MODIFY COLUMN activity
 ENUM('gather','harvest','craft_input','craft_output','upgrade','trade','chamber_transfer') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('126_restore_trade_ledger_activity')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
