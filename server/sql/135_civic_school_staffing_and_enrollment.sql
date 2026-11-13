-- Schools remain existing civic school upgrades; staffing and pupil places attach to them.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_school_staffing (
 upgrade_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 teachers INT UNSIGNED NOT NULL DEFAULT 0,
 support_staff INT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(upgrade_id) REFERENCES world_settlement_upgrades(id) ON DELETE CASCADE,
 CONSTRAINT chk_school_staffing_limits CHECK(teachers<=10000 AND support_staff<=10000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @school_building_col=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_dependents ADD COLUMN school_upgrade_id BIGINT UNSIGNED NULL',
 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_dependents' AND COLUMN_NAME='school_upgrade_id');
PREPARE school_building_stmt FROM @school_building_col;
EXECUTE school_building_stmt; DEALLOCATE PREPARE school_building_stmt;
SET @school_building_fk=(SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_dependents ADD CONSTRAINT fk_dependent_school_building FOREIGN KEY(school_upgrade_id) REFERENCES world_settlement_upgrades(id) ON DELETE SET NULL',
 'DO 0') FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='order_dependents' AND CONSTRAINT_NAME='fk_dependent_school_building');
PREPARE school_building_stmt FROM @school_building_fk;
EXECUTE school_building_stmt; DEALLOCATE PREPARE school_building_stmt;
SET @school_building_idx=(SELECT IF(COUNT(*)=0,
 'CREATE INDEX ix_dependent_school_building ON order_dependents(school_upgrade_id)',
 'DO 0') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='order_dependents' AND INDEX_NAME='ix_dependent_school_building');
PREPARE school_building_stmt FROM @school_building_idx;
EXECUTE school_building_stmt; DEALLOCATE PREPARE school_building_stmt;
INSERT INTO schema_migrations(version) VALUES('135_civic_school_staffing_and_enrollment')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
