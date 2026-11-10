-- Shipment itineraries link real road/rail/air freight legs without recreating stock.
-- A leg may start only after the previous shipment has actually arrived.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_logistics_itineraries (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 quantity DECIMAL(15,3) NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (item_id) REFERENCES world_industry_items(id),
 FOREIGN KEY (created_by) REFERENCES accounts(id),
 CONSTRAINT chk_itinerary_qty CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_logistics_itinerary_legs (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 itinerary_id BIGINT UNSIGNED NOT NULL,
 step_number SMALLINT UNSIGNED NOT NULL,
 source_facility_id BIGINT UNSIGNED NOT NULL,
 destination_facility_id BIGINT UNSIGNED NOT NULL,
 transport_template_id BIGINT UNSIGNED NOT NULL,
 shipment_id BIGINT UNSIGNED NULL,
 UNIQUE KEY uq_itinerary_step(itinerary_id,step_number),
 UNIQUE KEY uq_itinerary_shipment(shipment_id),
 FOREIGN KEY (itinerary_id) REFERENCES world_logistics_itineraries(id),
 FOREIGN KEY (source_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY (destination_facility_id) REFERENCES world_industry_facilities(id),
 FOREIGN KEY (transport_template_id) REFERENCES world_logistics_transport_templates(id),
 FOREIGN KEY (shipment_id) REFERENCES world_logistics_shipments(id),
 CONSTRAINT chk_itinerary_distinct CHECK(source_facility_id<>destination_facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('101_multimodal_freight_itineraries')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
