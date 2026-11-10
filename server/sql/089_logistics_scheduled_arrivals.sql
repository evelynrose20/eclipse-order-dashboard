-- Scheduler-originated freight events use NULL actor; never impersonate a human officer.
USE eclipse_order;
ALTER TABLE world_logistics_events MODIFY COLUMN actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL;
INSERT INTO schema_migrations(version) VALUES('089_logistics_scheduled_arrivals')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
