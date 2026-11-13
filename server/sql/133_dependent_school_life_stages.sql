// Add school/teen care and learning without converting dependents into adult characters.
USE eclipse_order;
SET @school_col=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='order_dependents' AND COLUMN_NAME='school_name');
SET @school_sql=IF(@school_col=0,
 'ALTER TABLE order_dependents ADD COLUMN school_name VARCHAR(120) NOT NULL DEFAULT ''''',
 'DO 0');
PREPARE school_stmt FROM @school_sql; EXECUTE school_stmt; DEALLOCATE PREPARE school_stmt;
SET @week_col=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='order_dependents' AND COLUMN_NAME='school_days');
SET @week_sql=IF(@week_col=0,
 'ALTER TABLE order_dependents ADD COLUMN school_days VARCHAR(20) NOT NULL DEFAULT ''1,2,3,4,5''',
 'DO 0');
PREPARE week_stmt FROM @week_sql; EXECUTE week_stmt; DEALLOCATE PREPARE week_stmt;
-- Existing nursery, infant, toddler and child records keep their current stage.
ALTER TABLE order_dependents MODIFY COLUMN stage
 ENUM('newborn','infant','toddler','child','teen') NOT NULL DEFAULT 'newborn';
ALTER TABLE order_dependent_care_events MODIFY COLUMN action
 ENUM('nursing','bottle','meal','comfort','hygiene','sleep','play','restock_milk','restock_food',
 'school','homework','reading','mathematics','athletics','creative','friends','independence','tutoring') NOT NULL;
CREATE TABLE IF NOT EXISTS order_dependent_milestones (
 dependent_id BIGINT UNSIGNED NOT NULL,
 milestone_id VARCHAR(60) NOT NULL,
 completed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(dependent_id,milestone_id),
 FOREIGN KEY (dependent_id) REFERENCES order_dependents(id) ON DELETE CASCADE,
 FOREIGN KEY (completed_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('133_dependent_school_life_stages')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
