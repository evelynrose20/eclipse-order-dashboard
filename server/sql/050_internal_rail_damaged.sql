-- Add the Damaged state to menu-based internal stations without touching old routes.
USE eclipse_order;
SET @rail_station_has_damaged := (
 SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='order_internal_rail_stations'
 AND COLUMN_NAME='status'
 AND COLUMN_TYPE LIKE '%damaged%'
);
SET @rail_station_damaged_sql := IF(
 @rail_station_has_damaged > 0,
 'SELECT 1',
 "ALTER TABLE order_internal_rail_stations MODIFY COLUMN status ENUM('planned','operational','closed','damaged') NOT NULL DEFAULT 'planned'"
);
PREPARE stmt_internal_rail_damaged FROM @rail_station_damaged_sql;
EXECUTE stmt_internal_rail_damaged;
DEALLOCATE PREPARE stmt_internal_rail_damaged;
INSERT INTO schema_migrations(version) VALUES('050_internal_rail_damaged')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
