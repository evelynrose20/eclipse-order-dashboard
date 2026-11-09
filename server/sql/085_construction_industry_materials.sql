-- Extend multi-event construction with industrial supplies without changing legacy contributions.
USE eclipse_order;
ALTER TABLE order_construction_requirements
  MODIFY COLUMN material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL;
ALTER TABLE order_construction_requirements
  ADD COLUMN industry_item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  ADD CONSTRAINT fk_construction_industry_item FOREIGN KEY(industry_item_id) REFERENCES world_industry_items(id),
  ADD UNIQUE KEY uq_construction_industry_item(stage_id,industry_item_id);
ALTER TABLE order_construction_contributions
  MODIFY COLUMN source ENUM('reserved','shared','facility') NOT NULL,
  ADD COLUMN facility_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_construction_delivery_facility FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id) ON DELETE SET NULL;
ALTER TABLE world_industry_ledger
  MODIFY COLUMN action ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('085_construction_industry_materials')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
