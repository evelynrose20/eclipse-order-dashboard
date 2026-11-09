-- Optional physical commissioned train consists for existing menu-based rail journeys.
-- Legacy journeys remain intact; linked journeys record capacity but do not invent freight.
USE eclipse_order;
SET @consist_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_internal_rail_journeys ADD COLUMN train_consist_id BIGINT UNSIGNED NULL',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='order_internal_rail_journeys' AND column_name='train_consist_id');
PREPARE rail_train_stmt FROM @consist_sql; EXECUTE rail_train_stmt; DEALLOCATE PREPARE rail_train_stmt;
SET @cargo_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_internal_rail_journeys ADD COLUMN cargo_capacity_snapshot INT UNSIGNED NOT NULL DEFAULT 0',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='order_internal_rail_journeys' AND column_name='cargo_capacity_snapshot');
PREPARE rail_cargo_stmt FROM @cargo_sql; EXECUTE rail_cargo_stmt; DEALLOCATE PREPARE rail_cargo_stmt;
SET @passenger_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_internal_rail_journeys ADD COLUMN passenger_capacity_snapshot INT UNSIGNED NOT NULL DEFAULT 0',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='order_internal_rail_journeys' AND column_name='passenger_capacity_snapshot');
PREPARE rail_passenger_stmt FROM @passenger_sql; EXECUTE rail_passenger_stmt; DEALLOCATE PREPARE rail_passenger_stmt;
SET @crew_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_internal_rail_journeys ADD COLUMN crew_required_snapshot INT UNSIGNED NOT NULL DEFAULT 0',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='order_internal_rail_journeys' AND column_name='crew_required_snapshot');
PREPARE rail_crew_stmt FROM @crew_sql; EXECUTE rail_crew_stmt; DEALLOCATE PREPARE rail_crew_stmt;
SET @fk_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE order_internal_rail_journeys ADD CONSTRAINT fk_internal_rail_train_consist FOREIGN KEY (train_consist_id) REFERENCES world_magitek_train_consists(id)',
 'DO 0') FROM information_schema.table_constraints WHERE table_schema=DATABASE()
 AND table_name='order_internal_rail_journeys' AND constraint_name='fk_internal_rail_train_consist');
PREPARE rail_train_fk_stmt FROM @fk_sql; EXECUTE rail_train_fk_stmt; DEALLOCATE PREPARE rail_train_fk_stmt;
INSERT INTO schema_migrations(version) VALUES('073_internal_rail_train_consists')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
