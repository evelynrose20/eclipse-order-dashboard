-- Weather protection and projects are additive and repeatable.
USE eclipse_order;
SET @industry_weather_column := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_facilities ADD COLUMN weather_protection_level TINYINT UNSIGNED NOT NULL DEFAULT 0',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_industry_facilities' AND column_name='weather_protection_level');
PREPARE weather_column FROM @industry_weather_column;
EXECUTE weather_column;
DEALLOCATE PREPARE weather_column;
SET @industry_upgrade_column := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_projects ADD COLUMN weather_upgrade_target TINYINT UNSIGNED NULL',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='world_industry_projects' AND column_name='weather_upgrade_target');
PREPARE weather_project FROM @industry_upgrade_column;
EXECUTE weather_project;
DEALLOCATE PREPARE weather_project;
INSERT INTO schema_migrations(version) VALUES('059_industry_climate_upgrades') ON DUPLICATE KEY UPDATE version=VALUES(version);
