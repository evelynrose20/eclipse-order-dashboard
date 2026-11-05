-- Storage for a complete, auditable Supabase PostgreSQL record snapshot.
-- The application API must NEVER expose these tables to member routes.
-- Source is not modified. Existing local account/character data is not deleted.
USE eclipse_order;

CREATE TABLE IF NOT EXISTS migration_runs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TIMESTAMP NULL DEFAULT NULL,
 status ENUM('running','complete','failed') NOT NULL DEFAULT 'running',
 source_tables INT NOT NULL DEFAULT 0,
 source_rows BIGINT NOT NULL DEFAULT 0,
 note VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_source_rows (
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 source_table VARCHAR(100) NOT NULL,
 row_number INT UNSIGNED NOT NULL,
 payload_json JSON NOT NULL,
 PRIMARY KEY(run_id,source_table,row_number),
 KEY ix_source_table(source_table),
 CONSTRAINT fk_migration_source_run FOREIGN KEY(run_id)
   REFERENCES migration_runs(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_source_counts (
 run_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 source_table VARCHAR(100) NOT NULL,
 expected_rows BIGINT NOT NULL,
 imported_rows BIGINT NOT NULL,
 PRIMARY KEY(run_id,source_table),
 CONSTRAINT fk_migration_counts_run FOREIGN KEY(run_id)
  REFERENCES migration_runs(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_character_ids (
 source_character_id VARCHAR(255) NOT NULL PRIMARY KEY,
 local_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 UNIQUE KEY uq_local_character_id (local_character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations(version) VALUES ('003_supabase_snapshot')
ON DUPLICATE KEY UPDATE version=VALUES(version);
