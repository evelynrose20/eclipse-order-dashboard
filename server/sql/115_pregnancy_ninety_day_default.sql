-- Three-month (90 IC day) default for future pregnancies only.
-- Existing story records, timelines and progression are deliberately untouched.
USE eclipse_order;
ALTER TABLE character_reproductive_profiles ALTER COLUMN pregnancy_total_days SET DEFAULT 90;
INSERT INTO schema_migrations(version) VALUES('115_pregnancy_ninety_day_default')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
