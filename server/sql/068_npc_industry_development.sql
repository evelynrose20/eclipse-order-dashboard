-- NPC civic development only accrues from demonstrated, faction-owned industrial production.
USE eclipse_order;
SET @npc_dev_date := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_settlement_autosim ADD COLUMN last_industry_development_date DATE NULL',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_settlement_autosim' AND column_name='last_industry_development_date');
PREPARE npc_dev_stmt FROM @npc_dev_date; EXECUTE npc_dev_stmt; DEALLOCATE PREPARE npc_dev_stmt;
SET @npc_dev_points := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_settlement_autosim ADD COLUMN last_industry_development_points INT UNSIGNED NOT NULL DEFAULT 0',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_settlement_autosim' AND column_name='last_industry_development_points');
PREPARE npc_points_stmt FROM @npc_dev_points; EXECUTE npc_points_stmt; DEALLOCATE PREPARE npc_points_stmt;
INSERT INTO schema_migrations(version) VALUES('068_npc_industry_development')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
