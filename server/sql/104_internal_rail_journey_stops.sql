-- Intermediate station stops for menu-based train journeys.
-- No track geometry or station map marker changes.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_internal_rail_journey_stops (
 journey_id BIGINT UNSIGNED NOT NULL,
 stop_number TINYINT UNSIGNED NOT NULL,
 station_id BIGINT UNSIGNED NOT NULL,
 settlement_id BIGINT UNSIGNED NOT NULL,
 arrival_at DATETIME(3) NOT NULL,
 departure_at DATETIME(3) NOT NULL,
 PRIMARY KEY(journey_id,stop_number),
 UNIQUE KEY uq_rail_journey_station(journey_id,station_id),
 INDEX ix_rail_station_arrival(station_id,arrival_at),
 CONSTRAINT fk_rail_stop_journey FOREIGN KEY(journey_id) REFERENCES order_internal_rail_journeys(id),
 CONSTRAINT fk_rail_stop_station FOREIGN KEY(station_id) REFERENCES order_internal_rail_stations(id),
 CONSTRAINT fk_rail_stop_settlement FOREIGN KEY(settlement_id) REFERENCES world_settlements(id),
 CONSTRAINT ck_rail_stop_time CHECK(departure_at>arrival_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('104_internal_rail_journey_stops') ON DUPLICATE KEY UPDATE version=VALUES(version);
