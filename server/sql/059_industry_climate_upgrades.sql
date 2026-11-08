-- Climate protection is constructed, never staff-set as a free percentage.
USE eclipse_order;
ALTER TABLE world_industry_facilities ADD COLUMN weather_protection_level TINYINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE world_industry_projects ADD COLUMN weather_upgrade_target TINYINT UNSIGNED NULL;
INSERT INTO schema_migrations(version) VALUES('059_industry_climate_upgrades') ON DUPLICATE KEY UPDATE version=VALUES(version);
