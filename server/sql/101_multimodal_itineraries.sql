-- Road / rail / airship through-deliveries, with reserved freight at intermediate depots.
-- Existing shipments, facilities, fleets and ledgers are preserved.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_itineraries (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 state ENUM('planned','in_transit','at_hub','delivered','cancelled','held') NOT NULL DEFAULT 'planned',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME NULL,
 CONSTRAINT fk_logistics_itinerary_item FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT fk_logistics_itinerary_actor FOREIGN KEY(created_by) REFERENCES accounts(id),
 CONSTRAINT ck_logistics_itinerary_quantity CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_itinerary_legs (
 itinerary_id BIGINT UNSIGNED NOT NULL,
 leg_number TINYINT UNSIGNED NOT NULL,
 mode ENUM('road','rail','air') NOT NULL,
 source_facility_id BIGINT UNSIGNED NOT NULL,
 destination_facility_id BIGINT UNSIGNED NOT NULL,
 transport_template_id BIGINT UNSIGNED NOT NULL,
 shipment_id BIGINT UNSIGNED NULL,
 PRIMARY KEY(itinerary_id,leg_number),
 UNIQUE KEY uq_itinerary_shipment(shipment_id),
 CONSTRAINT fk_logistics_leg_order FOREIGN KEY(itinerary_id) REFERENCES world_logistics_itineraries(id),
 CONSTRAINT fk_logistics_leg_source FOREIGN KEY(source_facility_id) REFERENCES world_industry_facilities(id),
 CONSTRAINT fk_logistics_leg_dest FOREIGN KEY(destination_facility_id) REFERENCES world_industry_facilities(id),
 CONSTRAINT fk_logistics_leg_template FOREIGN KEY(transport_template_id) REFERENCES world_logistics_transport_templates(id),
 CONSTRAINT fk_logistics_leg_shipment FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_itinerary_reservations (
 itinerary_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 facility_id BIGINT UNSIGNED NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 shipment_id BIGINT UNSIGNED NOT NULL UNIQUE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_logistics_reservation_order FOREIGN KEY(itinerary_id) REFERENCES world_logistics_itineraries(id),
 CONSTRAINT fk_logistics_reservation_facility FOREIGN KEY(facility_id) REFERENCES world_industry_facilities(id),
 CONSTRAINT fk_logistics_reservation_item FOREIGN KEY(item_id) REFERENCES world_industry_items(id),
 CONSTRAINT fk_logistics_reservation_shipment FOREIGN KEY(shipment_id) REFERENCES world_logistics_shipments(id),
 CONSTRAINT ck_itinerary_reservation_qty CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_itinerary_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 itinerary_id BIGINT UNSIGNED NOT NULL,
 action ENUM('plan','dispatch','stage','continue','deliver','hold','recall') NOT NULL,
 detail VARCHAR(300) NOT NULL DEFAULT '',
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_itinerary_events(itinerary_id,id),
 CONSTRAINT fk_itinerary_event_order FOREIGN KEY(itinerary_id) REFERENCES world_logistics_itineraries(id),
 CONSTRAINT fk_itinerary_event_actor FOREIGN KEY(actor_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Add ledger actions without narrowing the existing enum values.
ALTER TABLE world_industry_ledger MODIFY COLUMN action
 ENUM('produce','consume','byproduct','transfer_in','transfer_out','shared_in','project_commit','campaign_commit','military_supply','freight_dispatch','freight_arrival','freight_refund','freight_fuel','civic_delivery','corridor_build','military_delivery','freight_stage','freight_unstage') NOT NULL;
INSERT INTO schema_migrations(version) VALUES('101_multimodal_itineraries') ON DUPLICATE KEY UPDATE version=VALUES(version);
