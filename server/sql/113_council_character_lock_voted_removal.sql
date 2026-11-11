-- Link Council seats to real characters and require a recorded Council resolution to dismiss them.
-- Existing account appointments are deliberately kept; no ambiguous character is guessed.
USE eclipse_order;
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_council_offices' AND COLUMN_NAME='character_id');
SET @cmd := IF(@column_exists=0,'ALTER TABLE order_council_offices ADD COLUMN character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL, ADD UNIQUE KEY uq_council_character(character_id), ADD CONSTRAINT fk_council_office_character FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE SET NULL','SELECT 1');
PREPARE c FROM @cmd; EXECUTE c; DEALLOCATE PREPARE c;
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_council_motions' AND COLUMN_NAME='removal_office_code');
SET @cmd := IF(@column_exists=0,'ALTER TABLE order_council_motions ADD COLUMN removal_office_code VARCHAR(32) NULL, ADD COLUMN removal_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL, ADD COLUMN removal_account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL','SELECT 1');
PREPARE c FROM @cmd; EXECUTE c; DEALLOCATE PREPARE c;
-- Backfill a legacy appointment only when its account controls exactly one character.
UPDATE order_council_offices o
JOIN (SELECT player_account_id,MIN(id) AS character_id,COUNT(*) AS characters
 FROM characters WHERE player_account_id IS NOT NULL GROUP BY player_account_id) c ON c.player_account_id=o.account_id AND c.characters=1
 SET o.character_id=c.character_id WHERE o.code<>'domina' AND o.character_id IS NULL;
-- Bring only the untouched founding charter into line with voted removal; keep all custom revisions.
UPDATE order_governance_charter SET charter_text='The Domina presides over five permanent Council offices. She appoints characters to vacant seats. Locked appointments may only be removed following a successful major Council vote. Ordinary Council decisions require quorum and more affirmative than opposing votes. Major matters require the charter major threshold. Reserved matters also require explicit Domina ratification. Empty Council seats do not lower these thresholds. In-character rulings cannot change real account roles, OOC consent, moderation, security, financial balances or gameplay permissions.'
 WHERE revision=1 AND charter_text='The Domina presides over five permanent Council offices. She appoints or removes officers. Ordinary Council decisions require quorum and more affirmative than opposing votes. Major matters require the charter major threshold. Reserved matters also require explicit Domina ratification. Empty Council seats do not lower these thresholds. In-character rulings cannot change real account roles, OOC consent, moderation, security, financial balances or gameplay permissions.';
INSERT INTO schema_migrations(version) VALUES('113_council_character_lock_voted_removal')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
