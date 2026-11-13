-- Long-lived named adult descendants use existing civic housing buildings.
-- No aggregate population changes, new jobs or adult character sheets.
USE eclipse_order;
SET @home_col=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_named_civilians ADD COLUMN housing_upgrade_id BIGINT UNSIGNED NULL',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='world_named_civilians' AND COLUMN_NAME='housing_upgrade_id');
PREPARE home_stmt FROM @home_col;
EXECUTE home_stmt; DEALLOCATE PREPARE home_stmt;
SET @home_fk=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_named_civilians ADD CONSTRAINT fk_named_civilian_housing FOREIGN KEY(housing_upgrade_id) REFERENCES world_settlement_upgrades(id) ON DELETE SET NULL',
 'DO 0') FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='world_named_civilians' AND CONSTRAINT_NAME='fk_named_civilian_housing');
PREPARE home_stmt FROM @home_fk;
EXECUTE home_stmt; DEALLOCATE PREPARE home_stmt;
-- Age derived from the known IC birthdate; otherwise starts at age 18 when adulthood begins.
-- 350 years is the maximum natural lifespan for these special named civilians.
INSERT INTO schema_migrations(version) VALUES('136_named_civilian_homes_longevity')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
