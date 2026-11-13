-- Compatible with MariaDB 10.2+ and MySQL 8.0.16+.
-- Repair of migration 132: earlier versions used MySQL-only DROP CHECK syntax.
-- Safe to rerun after an interrupted setup. No pregnancy values are rewritten.
USE eclipse_order;

SET @has_old_term=(SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='character_reproductive_profiles'
 AND CONSTRAINT_NAME='chk_pregnancy_term' AND CONSTRAINT_TYPE='CHECK');

-- MariaDB needs DROP CONSTRAINT; MySQL uses DROP CHECK.
-- Skip dropping when a previous attempt already removed the constraint.
SET @drop_old_term=IF(@has_old_term=0, 'DO 0',
 IF(LOCATE('MariaDB', VERSION())>0,
   'ALTER TABLE character_reproductive_profiles DROP CONSTRAINT chk_pregnancy_term',
   'ALTER TABLE character_reproductive_profiles DROP CHECK chk_pregnancy_term'));
PREPARE term_stmt FROM @drop_old_term;
EXECUTE term_stmt;
DEALLOCATE PREPARE term_stmt;

-- Always restore the validated constraint, including when an earlier setup
-- stopped after DROP but before ADD. Ordinary registration remains 20-600
-- days in the API; 4-day terms require authorized voidsent lineage conception.
ALTER TABLE character_reproductive_profiles ADD CONSTRAINT chk_pregnancy_term
 CHECK(pregnancy_total_days BETWEEN 4 AND 600);

INSERT INTO schema_migrations(version) VALUES('132_voidsent_four_day_gestation')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
