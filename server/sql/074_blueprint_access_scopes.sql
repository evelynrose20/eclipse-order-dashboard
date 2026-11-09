-- Blueprint access boundaries across magitek, industry and civic infrastructure.
-- Existing public recipes remain shared. New designs are Order-private unless explicitly shared.
USE eclipse_order;
SET @magitek_scope_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_magitek_equipment_templates ADD COLUMN access_scope ENUM(''shared'',''order_only'') NOT NULL DEFAULT ''shared''',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='world_magitek_equipment_templates' AND column_name='access_scope');
PREPARE magitek_scope_stmt FROM @magitek_scope_sql; EXECUTE magitek_scope_stmt; DEALLOCATE PREPARE magitek_scope_stmt;
SET @industry_scope_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_industry_templates ADD COLUMN access_scope ENUM(''shared'',''order_only'') NOT NULL DEFAULT ''shared''',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='world_industry_templates' AND column_name='access_scope');
PREPARE industry_scope_stmt FROM @industry_scope_sql; EXECUTE industry_scope_stmt; DEALLOCATE PREPARE industry_scope_stmt;
SET @civic_scope_sql := (SELECT IF(COUNT(*)=0,
 'ALTER TABLE world_civic_building_templates ADD COLUMN access_scope ENUM(''shared'',''order_only'') NOT NULL DEFAULT ''shared''',
 'DO 0') FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='world_civic_building_templates' AND column_name='access_scope');
PREPARE civic_scope_stmt FROM @civic_scope_sql; EXECUTE civic_scope_stmt; DEALLOCATE PREPARE civic_scope_stmt;
-- One-time migration: staff-authored custom magitek designs are private by default.
-- Canonical Garlean patterns and existing industry/civic recipes remain shared.
SET @first_blueprint_scope_install := (SELECT IF(COUNT(*)=0,1,0) FROM schema_migrations
 WHERE version='074_blueprint_access_scopes');
UPDATE world_magitek_equipment_templates SET access_scope='order_only'
 WHERE @first_blueprint_scope_install=1 AND created_by IS NOT NULL
 AND lore_status IN ('original','lore_adapted');
INSERT INTO schema_migrations(version) VALUES('074_blueprint_access_scopes')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
