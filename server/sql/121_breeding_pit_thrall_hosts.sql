-- Keep legacy vat records readable, but default all future incubation records to bound-thrall hosts.
USE eclipse_order;
ALTER TABLE order_brood_incubations
 MODIFY COLUMN incubation_mode ENUM('vat','host') NOT NULL DEFAULT 'host';
INSERT INTO schema_migrations(version) VALUES('121_breeding_pit_thrall_hosts')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
