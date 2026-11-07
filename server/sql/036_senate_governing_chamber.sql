-- The Senate replaces the Council when established: 15 chambers and 3 heads.
-- Preserve previously appointed senators; no deletion of votes or offices.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_senate_seats (
 seat_number TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 appointed_at DATETIME NULL,
 UNIQUE KEY uq_senate_seat_account(account_id),
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL,
 CONSTRAINT ck_senate_seat_number CHECK (seat_number BETWEEN 1 AND 15)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_senate_seats(seat_number) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15);
CREATE TABLE IF NOT EXISTS order_senate_heads (
 head_number TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 title VARCHAR(90) NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 appointed_at DATETIME NULL,
 UNIQUE KEY uq_senate_head_account(account_id),
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL,
 CONSTRAINT ck_senate_head_number CHECK (head_number IN (2,3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_senate_heads(head_number,title) VALUES(2,'Second Head'),(3,'Third Head');
-- Transfer active appointments from the former senator roster into the 15 fixed seats.
-- Re-running this import leaves existing seat assignments untouched.
INSERT IGNORE INTO order_senate_seats(seat_number,account_id,appointed_at)
 SELECT ranked.seat_number,ranked.account_id,ranked.joined_at FROM (
  SELECT account_id,joined_at,ROW_NUMBER() OVER (ORDER BY joined_at,account_id) AS seat_number
  FROM order_senators WHERE active=1
 ) ranked
 WHERE ranked.seat_number<=15
 ON DUPLICATE KEY UPDATE account_id=COALESCE(order_senate_seats.account_id,VALUES(account_id)),
 appointed_at=COALESCE(order_senate_seats.appointed_at,VALUES(appointed_at));
INSERT INTO schema_migrations(version) VALUES('036_senate_governing_chamber') ON DUPLICATE KEY UPDATE version=VALUES(version);
