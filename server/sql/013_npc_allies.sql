-- Give DM-controlled NPC allies their own side in combat. Existing npc and player values stay intact.
USE eclipse_order;
SET @has_ally := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_combatants' AND COLUMN_NAME='kind' AND COLUMN_TYPE LIKE '%ally%');
SET @statement := IF(@has_ally=0,"ALTER TABLE order_combatants MODIFY COLUMN kind ENUM('npc','player','ally') NOT NULL","SELECT 'NPC ally type already installed' AS status");
PREPARE npc_ally_migration FROM @statement;
EXECUTE npc_ally_migration;
DEALLOCATE PREPARE npc_ally_migration;
INSERT INTO schema_migrations(version) VALUES('013_npc_allies') ON DUPLICATE KEY UPDATE version=VALUES(version);
