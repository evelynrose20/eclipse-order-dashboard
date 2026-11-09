-- NPC and Order settlement simulation must be an explicit staff opt-in.
-- Change the schema default without modifying existing settings or their history.
USE eclipse_order;
ALTER TABLE world_settlement_autosim
  MODIFY COLUMN mode ENUM('off','automatic') NOT NULL DEFAULT 'off';
INSERT INTO schema_migrations(version) VALUES('083_simulation_off_by_default')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
