-- Refreshable foreign buy orders for the FC Workshop & Garden catalog only.
-- Demand state is separate from contracts so completed deliveries and history are never rewritten.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS fc_trade_auto_demand (
 item_kind ENUM('material','equipment') NOT NULL,
 item_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 last_contract_id BIGINT UNSIGNED NULL,
 next_order_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(item_kind,item_id),
 CONSTRAINT fk_workshop_auto_contract FOREIGN KEY(last_contract_id) REFERENCES fc_trade_contracts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO schema_migrations(version) VALUES('108_workshop_exchange_demand')
ON DUPLICATE KEY UPDATE version=VALUES(version);
