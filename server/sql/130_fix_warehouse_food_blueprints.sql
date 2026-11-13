-- Correct original seeded warehouse construction bills that accidentally chose food
-- because migration 104 selected the first alphabetically sorted supply item.
-- Narrow predicates protect any custom blueprints or changed level recipes.
USE eclipse_order;
UPDATE world_logistics_warehouse_blueprint_levels l
JOIN world_logistics_warehouse_blueprints b ON b.id=l.blueprint_id
JOIN world_industry_items i ON i.id=JSON_UNQUOTE(JSON_EXTRACT(l.requirements,'$[0].item_id'))
SET l.requirements=JSON_ARRAY(JSON_OBJECT('item_id','iron-ingot','quantity',
 CASE b.id WHEN 1 THEN 30 WHEN 2 THEN 100 WHEN 3 THEN 300 END*l.level_number))
WHERE b.id IN (1,2,3)
 AND b.name=CASE b.id WHEN 1 THEN 'Supply Depot' WHEN 2 THEN 'Regional Storehouse' WHEN 3 THEN 'Grand Imperial Warehouse' END
 AND l.level_number BETWEEN 1 AND 3
 AND l.capacity_units=(CASE b.id WHEN 1 THEN 500 WHEN 2 THEN 2000 WHEN 3 THEN 6000 END)*l.level_number
 AND JSON_LENGTH(l.requirements)=1
 AND i.name='Preserved Fish'
 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(l.requirements,'$[0].quantity')) AS DECIMAL(15,3))=(CASE b.id WHEN 1 THEN 30 WHEN 2 THEN 100 WHEN 3 THEN 300 END)*l.level_number
 AND EXISTS(SELECT 1 FROM world_industry_items WHERE id='iron-ingot');
-- Planned, uncommissioned build orders capture their own copy of the old seed.
-- Correct only unbuilt warehouses still matching the original fish-only recipe.
UPDATE world_logistics_warehouse_build_orders bo
JOIN world_logistics_warehouses w ON w.id=bo.warehouse_id
JOIN world_logistics_warehouse_progress prog ON prog.warehouse_id=w.id
JOIN world_logistics_warehouse_blueprints b ON b.id=prog.blueprint_id
JOIN world_industry_items i ON i.id=JSON_UNQUOTE(JSON_EXTRACT(bo.requirements,'$[0].item_id'))
SET bo.requirements=JSON_ARRAY(JSON_OBJECT('item_id','iron-ingot','quantity',
 CASE b.id WHEN 1 THEN 30 WHEN 2 THEN 100 WHEN 3 THEN 300 END))
WHERE w.state='planned' AND prog.level_number=1 AND bo.target_level=1
 AND b.id IN (1,2,3)
 AND b.name=CASE b.id WHEN 1 THEN 'Supply Depot' WHEN 2 THEN 'Regional Storehouse' WHEN 3 THEN 'Grand Imperial Warehouse' END
 AND JSON_LENGTH(bo.requirements)=1 AND i.name='Preserved Fish'
 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(bo.requirements,'$[0].quantity')) AS DECIMAL(15,3))=CASE b.id WHEN 1 THEN 30 WHEN 2 THEN 100 WHEN 3 THEN 300 END
 AND EXISTS(SELECT 1 FROM world_industry_items WHERE id='iron-ingot');
UPDATE world_logistics_warehouses w
JOIN world_logistics_warehouse_progress prog ON prog.warehouse_id=w.id
JOIN world_logistics_warehouse_blueprints b ON b.id=prog.blueprint_id
JOIN world_industry_items i ON i.id=w.construction_item_id
SET w.construction_item_id='iron-ingot'
WHERE w.state='planned' AND prog.level_number=1 AND b.id IN (1,2,3)
 AND b.name=CASE b.id WHEN 1 THEN 'Supply Depot' WHEN 2 THEN 'Regional Storehouse' WHEN 3 THEN 'Grand Imperial Warehouse' END
 AND i.name='Preserved Fish'
 AND w.construction_quantity=CASE b.id WHEN 1 THEN 30 WHEN 2 THEN 100 WHEN 3 THEN 300 END
 AND EXISTS(SELECT 1 FROM world_industry_items WHERE id='iron-ingot');
INSERT INTO schema_migrations(version) VALUES('130_fix_warehouse_food_blueprints') ON DUPLICATE KEY UPDATE version=VALUES(version);
