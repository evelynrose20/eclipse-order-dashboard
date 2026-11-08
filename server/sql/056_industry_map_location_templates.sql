-- Non-destructive starter industries for existing map markers of all production types.
-- This catalog extends 055. Never overwrite user-published template revisions.
USE eclipse_order;
INSERT IGNORE INTO world_industry_items(id,name,category,workshop_material_id,description) VALUES
 ('fruit','Orchard Fruit','raw',NULL,'Default industry catalog'),
 ('fish','Fresh Fish','raw',NULL,'Default industry catalog'),
 ('iron-ore','Iron Ore','raw',NULL,'Default industry catalog'),
 ('ceruleum-crude','Crude Ceruleum','raw',NULL,'Default industry catalog'),
 ('ceruleum-fuel','Refined Ceruleum Fuel','fuel',NULL,'Default industry catalog'),
 ('iron-ingots','Iron Ingots','refined',NULL,'Default industry catalog'),
 ('machine-parts','Machine Parts','refined',NULL,'Default industry catalog'),
 ('power-cell','Power Cells','refined',NULL,'Default industry catalog');
INSERT IGNORE INTO world_industry_templates(name,slug,category,current_version,archived,created_by) VALUES
 ('Fruit Orchard','starter-orchard','agriculture',1,0,NULL),
 ('Fishing Docks','starter-fishery','agriculture',1,0,NULL),
 ('Ore Mine','starter-ore-mine','mine',1,0,NULL),
 ('Ceruleum Drilling Rig','starter-ceruleum-drilling','extraction',1,0,NULL),
 ('Ceruleum Refinery','starter-ceruleum-refinery','refinery',1,0,NULL),
 ('Iron Foundry','starter-ore-foundry','refinery',1,0,NULL),
 ('Assembly Workshop','starter-assembly-workshop','manufacturing',1,0,NULL),
 ('Ceruleum Generator','starter-ceruleum-generator','utilities',1,0,NULL);
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[],"outputs":[{"item_id":"fruit","qty":4}],"byproducts":[],"labor":2,"heat":0,"power":0,"capacity":3,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-orchard';
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[],"outputs":[{"item_id":"fish","qty":4}],"byproducts":[],"labor":3,"heat":0,"power":0,"capacity":3,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-fishery';
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[],"outputs":[{"item_id":"iron-ore","qty":3}],"byproducts":[],"labor":4,"heat":0,"power":0,"capacity":3,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-ore-mine';
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[],"outputs":[{"item_id":"ceruleum-crude","qty":3}],"byproducts":[],"labor":4,"heat":0,"power":0,"capacity":3,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-ceruleum-drilling';
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[{"item_id":"ceruleum-crude","qty":3}],"outputs":[{"item_id":"ceruleum-fuel","qty":2}],"byproducts":[],"labor":4,"heat":1,"power":1,"capacity":2,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-ceruleum-refinery';
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[{"item_id":"iron-ore","qty":3}],"outputs":[{"item_id":"iron-ingots","qty":2}],"byproducts":[],"labor":5,"heat":2,"power":1,"capacity":2,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-ore-foundry';
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[{"item_id":"iron-ingots","qty":2},{"item_id":"sawn-timber","qty":2}],"outputs":[{"item_id":"machine-parts","qty":2}],"byproducts":[],"labor":5,"heat":0,"power":1,"capacity":2,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-assembly-workshop';
INSERT IGNORE INTO world_industry_template_versions(template_id,version,configuration,rules)
 SELECT id,1,'{"inputs":[{"item_id":"ceruleum-fuel","qty":2}],"outputs":[{"item_id":"power-cell","qty":2}],"byproducts":[],"labor":4,"heat":0,"power":0,"capacity":2,"upgrade_level":1}',JSON_ARRAY() FROM world_industry_templates WHERE slug='starter-ceruleum-generator';
INSERT INTO schema_migrations(version) VALUES('056_industry_map_location_templates')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
