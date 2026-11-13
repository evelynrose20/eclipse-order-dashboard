-- Reconfigure only the pregnancy term constraint. No existing pregnancy values are modified.
-- The API still permits manual ordinary registration only for 20-600 days; accelerated
-- four-day terms are assigned exclusively to authorized voidsent lineage conceptions.
USE eclipse_order;
SET @has_old_term=(SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='character_reproductive_profiles'
 AND CONSTRAINT_NAME='chk_pregnancy_term' AND CONSTRAINT_TYPE='CHECK');
SET @drop_old_term=IF(@has_old_term>0,
 'ALTER TABLE character_reproductive_profiles DROP CHECK chk_pregnancy_term','DO 0');
PREPARE term_stmt FROM @drop_old_term;
EXECUTE term_stmt;
DEALLOCATE PREPARE term_stmt;
ALTER TABLE character_reproductive_profiles ADD CONSTRAINT chk_pregnancy_term
 CHECK(pregnancy_total_days BETWEEN 4 AND 600);
INSERT INTO schema_migrations(version) VALUES('132_voidsent_four_day_gestation')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
