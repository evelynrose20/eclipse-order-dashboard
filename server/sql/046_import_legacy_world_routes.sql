-- Import old settlement-to-settlement lines into the graph exactly once.
-- The original world_map_routes table remains untouched as a historical backup.
USE eclipse_order;
SET @legacy_field_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='world_route_segments' AND COLUMN_NAME='legacy_route_id');
SET @ddl := IF(@legacy_field_exists=0,"ALTER TABLE world_route_segments ADD COLUMN legacy_route_id BIGINT UNSIGNED NULL, ADD UNIQUE KEY uq_route_segment_legacy(legacy_route_id)","SELECT 1");
PREPARE legacy_ddl FROM @ddl; EXECUTE legacy_ddl; DEALLOCATE PREPARE legacy_ddl;

SET @needs_graph_import := IF(EXISTS(SELECT 1 FROM schema_migrations WHERE version='046_import_legacy_world_routes'),0,1);
INSERT IGNORE INTO world_route_nodes(region_id,settlement_id,name,node_kind,map_x,map_y,created_by)
 SELECT s.region_id,s.id,s.name,'terminal',s.map_x,s.map_y,r.created_by
 FROM world_settlements s JOIN world_regions r ON r.id=s.region_id
 WHERE @needs_graph_import=1;
INSERT IGNORE INTO world_route_segments(region_id,from_node_id,to_node_id,route_type,route_name,waypoints,created_by,legacy_route_id)
 SELECT old.region_id,n1.id,n2.id,old.route_type,old.route_name,old.waypoints,old.created_by,old.id
 FROM world_map_routes old
 JOIN world_route_nodes n1 ON n1.region_id=old.region_id AND n1.settlement_id=old.from_settlement_id
 JOIN world_route_nodes n2 ON n2.region_id=old.region_id AND n2.settlement_id=old.to_settlement_id
 WHERE @needs_graph_import=1;
INSERT INTO schema_migrations(version) VALUES('046_import_legacy_world_routes')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
